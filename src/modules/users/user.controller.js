import {
  getAllUsersWithStats,
  getUserById,
  updateUser,
  deleteUser,
} from "./user.service.js";

/* =====================================================
   📦 GET ALL USERS
===================================================== */

export const getUsers = async (
  req,
  res
) => {
  try {
    const users =
      await getAllUsersWithStats();

    return res.json({
      success: true,
      count: users.length,
      data: users,
    });
  } catch (error) {
    console.error(
      "getUsers error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to fetch users",
    });
  }
};

/* =====================================================
   📦 GET SINGLE USER
===================================================== */

export const getUser = async (
  req,
  res
) => {
  try {
    const user =
      await getUserById(
        req.params.id
      );

    return res.json(user);
  } catch (err) {
    console.error(
      "getUser error:",
      err
    );

    return res.status(404).json({
      success: false,
      message:
        err.message ||
        "User not found",
    });
  }
};
/* =====================================================
   ✏️ UPDATE USER
===================================================== */

export const updateUserController =
  async (req, res) => {
    try {
      await updateUser(
        req.params.id,
        req.body
      );

      return res.json({
        success: true,
        message:
          "User updated successfully",
      });
    } catch (error) {
      console.error(
        "updateUser error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          error.message ||
          "Failed to update user",
      });
    }
  };

/* =====================================================
   ❌ DELETE USER
===================================================== */

export const deleteUserController =
  async (req, res) => {
    try {
      await deleteUser(
        req.params.id
      );

      return res.json({
        success: true,
        message:
          "User deleted successfully",
      });
    } catch (error) {
      console.error(
        "deleteUser error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          error.message ||
          "Failed to delete user",
      });
    }
  };