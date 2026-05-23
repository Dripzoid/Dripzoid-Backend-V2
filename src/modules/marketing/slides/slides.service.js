import prisma from "../../../lib/prisma.js";

/* =====================================================
   📦 PUBLIC SLIDES
===================================================== */

export async function getPublicSlidesService() {
  const slides =
    await prisma.slide.findMany({
      where: {
        isDeleted: false,
      },

      orderBy: {
        orderIndex: "asc",
      },

      select: {
        id: true,

        name: true,

        imageUrl: true,

        link: true,

        orderIndex: true,
      },
    });

  return slides.map((slide) => ({
    id: slide.id,

    name: slide.name,

    src:
      slide.imageUrl || "",

    link:
      slide.link || null,

    order_index:
      slide.orderIndex || 0,
  }));
}

/* =====================================================
   📦 ADMIN SLIDES
===================================================== */

export async function getAdminSlidesService() {
  return prisma.slide.findMany({
    where: {
      isDeleted: false,
    },

    orderBy: {
      orderIndex: "asc",
    },
  });
}

/* =====================================================
   ➕ CREATE SLIDE
===================================================== */

export async function createSlideService({
  name,
  image_url,
  link,
}) {
  /* =========================
     VALIDATION
  ========================= */

  if (
    !name ||
    !image_url
  ) {
    throw new Error(
      "Name and image_url required"
    );
  }

  /* =========================
     GET NEXT ORDER INDEX
  ========================= */

  const lastSlide =
    await prisma.slide.findFirst({
      orderBy: {
        orderIndex:
          "desc",
      },
    });

  const nextOrderIndex =
    lastSlide
      ? lastSlide.orderIndex +
        1
      : 0;

  /* =========================
     CREATE SLIDE
  ========================= */

  const slide =
    await prisma.slide.create({
      data: {
        name,

        imageUrl:
          image_url,

        link:
          link || null,

        orderIndex:
          nextOrderIndex,
      },
    });

  return {
    id: slide.id,

    name:
      slide.name,

    image_url:
      slide.imageUrl,

    link:
      slide.link,
  };
}

/* =====================================================
   ✏️ UPDATE SLIDE
===================================================== */

export async function updateSlideService(
  id,
  {
    name,
    image_url,
    link,
    order_index,
  }
) {
  /* =========================
     CHECK EXISTENCE
  ========================= */

  const existingSlide =
    await prisma.slide.findUnique({
      where: {
        id,
      },
    });

  if (!existingSlide) {
    throw new Error(
      "Slide not found"
    );
  }

  /* =========================
     UPDATE SLIDE
  ========================= */

  await prisma.slide.update({
    where: {
      id,
    },

    data: {
      name:
        name ??
        existingSlide.name,

      imageUrl:
        image_url ??
        existingSlide.imageUrl,

      link:
        link ??
        existingSlide.link,

      orderIndex:
        order_index ??
        existingSlide.orderIndex,
    },
  });

  return true;
}

/* =====================================================
   ❌ DELETE SLIDE
===================================================== */

export async function deleteSlideService(
  id
) {
  /* =========================
     CHECK EXISTENCE
  ========================= */

  const existingSlide =
    await prisma.slide.findUnique({
      where: {
        id,
      },
    });

  if (!existingSlide) {
    throw new Error(
      "Slide not found"
    );
  }

  /* =========================
     SOFT DELETE
  ========================= */

  await prisma.slide.update({
    where: {
      id,
    },

    data: {
      isDeleted: true,
    },
  });

  return true;
}