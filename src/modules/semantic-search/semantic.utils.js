export function buildProductEmbeddingText(
  product
) {
  return `
Name: ${product.name}

Category:
${product.category?.category || ""}

Subcategory:
${product.subcategory || ""}

Colors:
${Array.isArray(product.colors)
    ? product.colors.join(", ")
    : ""}

Description:
${product.description || ""}
`.trim();
}
