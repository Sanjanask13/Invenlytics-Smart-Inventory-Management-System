export function generateReorderMessage(supplierName, productName, quantity, date = "today") {
  return `Order Request:
Supplier: ${supplierName}
Product: ${productName}
Quantity: ${quantity} units
Date: ${date}`;
}
