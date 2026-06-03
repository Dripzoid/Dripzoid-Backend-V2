import {
  generateEmbedding,
} from "./embedding.service.js";

export async function embedText(
  req,
  res
) {
  try {

    const { text } =
      req.body;

    if (!text?.trim()) {
      return res
        .status(400)
        .json({
          success: false,
          message:
            "Text is required"
        });
    }

    const embedding =
      await generateEmbedding(
        text
      );

    return res.json({
      success: true,
      embedding,
    });

  } catch (error) {

    console.error(error);

    return res
      .status(500)
      .json({
        success: false,
        message:
          "Failed to generate embedding"
      });
  }
}
