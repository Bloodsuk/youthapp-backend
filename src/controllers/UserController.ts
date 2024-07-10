import HttpStatusCodes from "@src/constants/HttpStatusCodes";

import UserService from "@src/services/UserService";
import { IReq, IRes } from "@src/types/express/misc";
import { RouteError } from "@src/other/classes";
import { UserLevels } from "@src/constants/enums";

// **** Functions **** //

/**
 * Get all users.
 */
async function getAll(req: IReq, res: IRes) {
  // const user_id = res.locals.sessionUser?.id;
  // console.log('user_id: ', user_id);
  let page = parseInt(req.query.page as string);
  if (isNaN(page)) page = 1;
  const result = await UserService.getAll(page);
  return res
    .status(HttpStatusCodes.OK)
    .json({ users: result.data, total: result.total });
}
/**
 * Get all practitioners.
 */
async function getAllPractitioners(req: IReq, res: IRes) {
  let page = parseInt(req.query.page as string);
  if (isNaN(page)) page = 1;
  const search = (req.query.search as string) || "";
  const result = await UserService.getAllPractitioners(page, search);
  return res
    .status(HttpStatusCodes.OK)
    .json({ practitioners: result.data, total: result.total });
}

/**
 * Get all clinics.
 */
async function getAllClinics(req: IReq, res: IRes) {
  let page = parseInt(req.query.page as string);
  if (isNaN(page)) page = 1;
  const search = (req.query.search as string) || "";
  const result = await UserService.getAllClinics(res.locals.sessionUser?.id || 0, page, search);
  return res
    .status(HttpStatusCodes.OK)
    .json({ clinics: result.data, total: result.total });
}

/**
 * Get user by Id.
 */
async function getById(req: IReq, res: IRes) {
  const id = parseInt(req.params.id);
  try {
    const user = await UserService.getOne(id);
    return res
      .status(HttpStatusCodes.OK)
      .json({
        success: true,
        user: user,
      })
      .end();
  } catch (error) {
    if (error instanceof RouteError)
      return res
        .status(error.status)
        .json({
          success: false,
          error: error.message,
        })
        .end();
    else
      return res
        .status(HttpStatusCodes.INTERNAL_SERVER_ERROR)
        .json({
          success: false,
          error: "Internal Error: " + error,
        })
        .end();
  }
}

/**
 * Add one user.
 */
async function add(req: IReq<{ user: Record<string, any> }>, res: IRes) {
  const { user } = req.body;
  const isAdmin = res.locals.sessionUser?.user_level === UserLevels.Admin;

  const id = await UserService.addOne(
    user,
    isAdmin,
    res.locals.sessionUser?.id || 0
  );
  if (id)
    return res
      .status(HttpStatusCodes.CREATED)
      .json({
        success: true,
        user: await UserService.getOne(id),
      })
      .end();
  else return res.status(HttpStatusCodes.BAD_REQUEST).end();
}

/**
 * Update one user.
 */
async function update(req: IReq<{ user: Record<string, any> }>, res: IRes) {
  const { user } = req.body;
  const id = req.params.id;
  const uid = parseInt(id);
  try {
    await UserService.updateOne(uid, user);
    return res.status(HttpStatusCodes.OK).json({ success: true }).end();
  } catch (error) {
    if (error instanceof RouteError)
      return res
        .status(error.status)
        .json({
          success: false,
          error: error.message,
        })
        .end();
    else
      return res
        .status(HttpStatusCodes.INTERNAL_SERVER_ERROR)
        .json({
          success: false,
          error: "Internal Error: " + error,
        })
        .end();
  }
}
/**
 * Activate one user.
 */
async function activate(req: IReq<{ user_id: number }>, res: IRes) {
  const { user_id } = req.body;
  const user_level = res.locals.sessionUser?.user_level;
  if (
    user_level !== UserLevels.Admin &&
    user_level !== UserLevels.Practitioner
  ) {
    return res
      .status(HttpStatusCodes.FORBIDDEN)
      .json({
        success: false,
        error: "You are not authorized to perform this operation",
      })
      .end();
  }
  let practitioner_id: number | undefined = undefined;
  if (res.locals.sessionUser?.user_level === UserLevels.Practitioner)
    practitioner_id = res.locals.sessionUser?.id;
  console.log("practitioner_id: ", practitioner_id);

  try {
    await UserService.updateStatus(user_id, 1, practitioner_id);
    return res.status(HttpStatusCodes.OK).json({ success: true }).end();
  } catch (error) {
    if (error instanceof RouteError)
      return res
        .status(error.status)
        .json({
          success: false,
          error: error.message,
        })
        .end();
    else
      return res
        .status(HttpStatusCodes.INTERNAL_SERVER_ERROR)
        .json({
          success: false,
          error: "Internal Error: " + error,
        })
        .end();
  }
}
/**
 * DeActivate one user.
 */
async function deactivate(req: IReq<{ user_id: number }>, res: IRes) {
  const { user_id } = req.body;
  const user_level = res.locals.sessionUser?.user_level;
  if (
    user_level !== UserLevels.Admin &&
    user_level !== UserLevels.Practitioner
  ) {
    return res
      .status(HttpStatusCodes.FORBIDDEN)
      .json({
        success: false,
        error: "You are not authorized to perform this operation",
      })
      .end();
  }
  let practitioner_id: number | undefined = undefined;
  if (res.locals.sessionUser?.user_level === UserLevels.Practitioner)
    practitioner_id = res.locals.sessionUser?.id;
  console.log("practitioner_id: ", practitioner_id);

  try {
    await UserService.updateStatus(user_id, 0, practitioner_id);
    return res.status(HttpStatusCodes.OK).json({ success: true }).end();
  } catch (error) {
    if (error instanceof RouteError)
      return res
        .status(error.status)
        .json({
          success: false,
          error: error.message,
        })
        .end();
    else
      return res
        .status(HttpStatusCodes.INTERNAL_SERVER_ERROR)
        .json({
          success: false,
          error: "Internal Error: " + error,
        })
        .end();
  }
}
/**
 * Update many users.
 */
// async function updateMany(req: IReq<{ users: IUser[] }>, res: IRes) {
//   const { users } = req.body;
//   try {
//     const allUpdated = await UserService.updateMany(users);
//     if (!allUpdated) {
//       throw new RouteError(HttpStatusCodes.BAD_REQUEST, "Some users could not be updated");
//     }
//     return res.status(HttpStatusCodes.OK).end();
//   } catch (error) {
//     if (error instanceof RouteError)
//       return res
//         .status(error.status)
//         .json({
//           success: false,
//           error: error.message,
//         })
//         .end();
//     else
//       return res
//         .status(HttpStatusCodes.INTERNAL_SERVER_ERROR)
//         .json({
//           success: false,
//           error: "Internal Error: " + error,
//         })
//         .end();
//   }
// }

/**
 * Update user's email.
 */
async function updateEmail(
  req: IReq<{ id: number; email: string }>,
  res: IRes
) {
  const { id, email } = req.body;
  try {
    const updated = await UserService.updateEmail(id, email);
    if (!updated) {
      throw new RouteError(
        HttpStatusCodes.BAD_REQUEST,
        "Email could not be updated"
      );
    }
    return res.status(HttpStatusCodes.OK).end();
  } catch (error) {
    if (error instanceof RouteError)
      return res
        .status(error.status)
        .json({
          success: false,
          error: error.message,
        })
        .end();
    else
      return res
        .status(HttpStatusCodes.INTERNAL_SERVER_ERROR)
        .json({
          success: false,
          error: "Internal Error: " + error,
        })
        .end();
  }
}

/**
 * Update user's passowrd.
 */
async function updatePassword(
  req: IReq<{ email: string; password: string }>,
  res: IRes
) {
  const { email, password } = req.body;
  try {
    const updated = await UserService.updatePassword(email, password);
    if (!updated) {
      throw new RouteError(
        HttpStatusCodes.BAD_REQUEST,
        "Password could not be updated"
      );
    }
    return res.status(HttpStatusCodes.OK).end();
  } catch (error) {
    if (error instanceof RouteError)
      return res
        .status(error.status)
        .json({
          success: false,
          error: error.message,
        })
        .end();
    else
      return res
        .status(HttpStatusCodes.INTERNAL_SERVER_ERROR)
        .json({
          success: false,
          error: "Internal Error: " + error,
        })
        .end();
  }
}

/**
 * Delete one user.
 */
async function delete_(req: IReq, res: IRes) {
  const id = req.params.id;
  const uid = parseInt(id);
  try {
    await UserService.delete(uid);
    return res
      .status(HttpStatusCodes.OK)
      .json({
        success: true,
      })
      .end();
  } catch (error) {
    if (error instanceof RouteError)
      return res
        .status(error.status)
        .json({
          success: false,
          error: error.message,
        })
        .end();
    else
      return res
        .status(HttpStatusCodes.INTERNAL_SERVER_ERROR)
        .json({
          success: false,
          error: "Internal Error: " + error,
        })
        .end();
  }
}

// **** Export default **** //

export default {
  getAll,
  getAllPractitioners,
  getAllClinics,
  getById,
  add,
  update,
  // updateMany,
  activate,
  deactivate,
  updateEmail,
  updatePassword,
  delete: delete_,
} as const;
