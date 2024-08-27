import HttpStatusCodes from "@src/constants/HttpStatusCodes";
import ClinicService from "@src/services/UserService";
import { IReq, IRes } from "@src/types/express/misc";
import { RouteError } from "@src/other/classes";
import { UserLevels } from "@src/constants/enums";

// **** Functions **** //

/**
 * Get all clinics.
 */
async function getAll(req: IReq, res: IRes) {
  let page = parseInt(req.query.page as string);
  if (isNaN(page)) page = 1;
  const search = (req.query.search as string) || "";
  const result = await ClinicService.getAllClinics(0, page, search);
  return res
    .status(HttpStatusCodes.OK)
    .json({ clinics: result.data, total: result.total });
}

/**
 * Get all practitioner clinics.
 */
async function getPractitionerClinic(req: IReq, res: IRes) {
  let page = parseInt(req.query.page as string);
  let practitioner_id = parseInt(req.params.practitioner_id as string);
  if (isNaN(page)) page = 1;
  const search = (req.query.search as string) || "";
  const result = await ClinicService.getAllClinics(practitioner_id, page, search);
  return res
    .status(HttpStatusCodes.OK)
    .json({ clinics: result.data, total: result.total });
}

/**
 * Get clinic by Id.
 */
async function getById(req: IReq, res: IRes) {
  const id = parseInt(req.params.id);
  try {
    const clinic = await ClinicService.getOne(id);
    return res
      .status(HttpStatusCodes.OK)
      .json({
        success: true,
        clinic: clinic,
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
 * Add one clinic.
 */
async function add(req: IReq<{ clinic: Record<string, any> }>, res: IRes) {
  const { clinic } = req.body;
  const isAdmin = res.locals.sessionUser?.user_level === UserLevels.Admin;

  const id = await ClinicService.addOne(
    clinic,
    isAdmin,
    res.locals.sessionUser?.id || clinic.practitioner_id
  );
  if (id)
    return res
      .status(HttpStatusCodes.CREATED)
      .json({
        success: true,
        clinic: await ClinicService.getOne(id),
      })
      .end();
  else return res.status(HttpStatusCodes.BAD_REQUEST).end();
}

/**
 * Update one clinic.
 */
async function update(req: IReq<{ clinic: Record<string, any> }>, res: IRes) {
  const { clinic } = req.body;
  const id = req.params.id;
  const uid = parseInt(id);
  try {
    await ClinicService.updateOne(uid, clinic);
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
 * Activate one clinic.
 */
async function activate(req: IReq<{ clinic_id: number, is_active: number }>, res: IRes) {
  const { clinic_id, is_active } = req.body;
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
    await ClinicService.updateStatus(clinic_id, is_active, practitioner_id);
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
 * Delete one clinic.
 */
async function delete_(req: IReq, res: IRes) {
  const id = req.params.id;
  const uid = parseInt(id);
  try {
    await ClinicService.delete(uid);
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
  getPractitionerClinic,
  getById,
  add,
  update,
  activate,
  delete: delete_,
} as const;
