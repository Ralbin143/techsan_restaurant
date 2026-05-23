import { Branch } from "../models/Branch.js";
import { ValidationError } from "./apiError.js";

/** Resolve branch for users without branchId (e.g. super_admin). */
export async function resolveBranchId(user, queryBranchId) {
  if (queryBranchId) return queryBranchId;
  if (user?.branchId) return user.branchId.toString();

  if (!user?.restaurantId) {
    throw new ValidationError("branchId is required");
  }

  const branch = await Branch.findOne({
    restaurantId: user.restaurantId,
    isActive: true,
  }).sort({ createdAt: 1 });

  if (!branch) {
    throw new ValidationError("No branch found for this restaurant");
  }

  return branch._id.toString();
}
