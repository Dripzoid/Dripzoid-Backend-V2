export function buildEmbeddingText(
  product
) {
  return `
Name:
${product.name}

Category:
${product.category?.category}

Subcategory:
${product.subcategory}

Colors:
${product.colors?.join(", ")}

Description:
${product.description}
`;
}
