import prisma from "../../lib/prisma.js";

export async function getAddresses(
  userId
) {
  return prisma.address.findMany({
    where: { userId },

    orderBy: {
      createdAt: "desc",
    },
  });
}

export async function getAddressById(
  id,
  userId
) {
  return prisma.address.findFirst({
    where: {
      id,
      userId,
    },
  });
}

export async function getDefaultAddress(
  userId
) {
  return prisma.address.findFirst({
    where: {
      userId,
      isDefault: true,
    },
  });
}

export async function createAddress(
  userId,
  data
) {
  return prisma.$transaction(
    async (tx) => {
      if (data.isDefault) {
        await tx.address.updateMany({
          where: { userId },

          data: {
            isDefault: false,
          },
        });
      }

      return tx.address.create({
        data: {
          ...data,
          userId,
        },
      });
    }
  );
}

export async function updateAddress(
  id,
  userId,
  data
) {
  return prisma.$transaction(
    async (tx) => {
      const existing =
        await tx.address.findFirst({
          where: {
            id,
            userId,
          },
        });

      if (!existing) {
        return null;
      }

      if (data.isDefault) {
        await tx.address.updateMany({
          where: { userId },

          data: {
            isDefault: false,
          },
        });
      }

      return tx.address.update({
        where: { id },

        data,
      });
    }
  );
}

export async function deleteAddress(
  id,
  userId
) {
  const existing =
    await prisma.address.findFirst({
      where: {
        id,
        userId,
      },
    });

  if (!existing) {
    return false;
  }

  await prisma.address.delete({
    where: { id },
  });

  return true;
}