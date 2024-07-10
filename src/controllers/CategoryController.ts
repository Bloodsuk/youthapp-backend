import HttpStatusCodes from "@src/constants/HttpStatusCodes";

import CategoryService from "@src/services/CategoryService";
import { IReq, IRes } from "@src/types/express/misc";
import { RouteError } from "@src/other/classes";

// **** Functions **** //

/**
 * Get all categories.
 */
async function getAll(req: IReq, res: IRes) {
  let page = parseInt(req.query.page as string);
  if(isNaN(page)) page = 1;
  const search = (req.query.search as string) || "";

  const { data, total } = await CategoryService.getAll(page, search);
  return res.status(HttpStatusCodes.OK).json({ categories: data, total });
}

/**
 * Get category by Id.
 */
async function getById(req: IReq, res: IRes) {
  const id = parseInt(req.params.id);
  try {
    const category = await CategoryService.getOne(id);
    return res
      .status(HttpStatusCodes.OK)
      .json({
        success: true,
        category: category,
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
 * Add one category.
 */
async function add(req: IReq<{ category: Record<string, any> }>, res: IRes) {
  const { category } = req.body;

  const id = await CategoryService.addOne(category);
  if (id)
    return res
      .status(HttpStatusCodes.CREATED)
      .json({
        success: true,
        id: id
      })
      .end();
  else return res.status(HttpStatusCodes.BAD_REQUEST).end();
}

/**
 * Update one category.
 */
async function update(req: IReq<{ category: Record<string, any> }>, res: IRes) {
  const { category } = req.body;
  const id = req.params.id;
  const uid = parseInt(id);
  try {
    await CategoryService.updateOne(uid, category);
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
 * Delete one category.
 */
async function delete_(req: IReq, res: IRes) {
  const id = req.params.id;
  const uid = parseInt(id);
  try {
    await CategoryService.delete(uid);
    return res.status(HttpStatusCodes.OK).json({
      success: true
    }).end();
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
  getById,
  add,
  update,
  delete: delete_,
} as const;
