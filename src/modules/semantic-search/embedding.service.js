const OLLAMA_URL =
  "http://144.24.153.133:11434/api/embeddings";

export async function generateEmbedding(
  text
) {
  const response =
    await fetch(
      OLLAMA_URL,
      {
        method: "POST",
        headers: {
          "Content-Type":
            "application/json",
        },
        body: JSON.stringify({
          model:
            "nomic-embed-text",
          prompt: text,
        }),
      }
    );

  if (!response.ok) {
    throw new Error(
      `Embedding Error: ${response.status}`
    );
  }

  const data =
    await response.json();

  return data.embedding;
}
