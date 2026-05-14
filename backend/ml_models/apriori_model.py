import pandas as pd
from mlxtend.frequent_patterns import apriori, association_rules

from models.billing_model import Bill, BillItem


def prepare_transactions_from_bills(store_id=None):
    bill_query = Bill.query
    if store_id:
        bill_query = bill_query.filter(Bill.store_id == store_id)

    bills = bill_query.order_by(Bill.bill_id.asc()).all()
    bill_ids = [bill.bill_id for bill in bills]

    if not bill_ids:
        return pd.DataFrame()

    bill_items = (
        BillItem.query.filter(BillItem.bill_id.in_(bill_ids))
        .order_by(BillItem.bill_id.asc(), BillItem.bill_item_id.asc())
        .all()
    )

    transactions = {}
    for item in bill_items:
        transactions.setdefault(item.bill_id, set()).add(item.product_id)

    if not transactions:
        return pd.DataFrame()

    basket_rows = [
        {"bill_id": bill_id, "product_id": product_id}
        for bill_id, product_ids in transactions.items()
        for product_id in product_ids
    ]

    basket_df = pd.DataFrame(basket_rows)
    basket = basket_df.assign(value=1).pivot_table(
        index="bill_id",
        columns="product_id",
        values="value",
        aggfunc="max",
        fill_value=0,
    )

    return basket.astype(int)


def train_apriori_from_bills(store_id=None, min_support=0.02, min_threshold=1.0):
    basket = prepare_transactions_from_bills(store_id=store_id)

    if basket.empty or len(basket.index) < 2:
        return pd.DataFrame()

    frequent_items = apriori(basket, min_support=min_support, use_colnames=True)
    if frequent_items.empty:
        return pd.DataFrame()

    rules = association_rules(frequent_items, metric="lift", min_threshold=min_threshold)
    if rules.empty:
        return pd.DataFrame()

    return rules.sort_values(
        by=["lift", "confidence", "support"],
        ascending=False,
    ).reset_index(drop=True)


def get_recommendations(product_id, store_id=None, min_support=0.02, min_threshold=1.0):
    rules = train_apriori_from_bills(
        store_id=store_id,
        min_support=min_support,
        min_threshold=min_threshold,
    )

    if rules.empty:
        return []

    recommendations = []
    seen = set()

    for _, row in rules.iterrows():
        if product_id not in row["antecedents"]:
            continue

        for item in row["consequents"]:
            if item == product_id or item in seen:
                continue

            seen.add(item)
            recommendations.append({
                "product_id": item,
                "confidence": round(float(row["confidence"]), 4),
                "lift": round(float(row["lift"]), 4),
                "support": round(float(row["support"]), 4),
            })

    return recommendations


def get_real_transaction_baskets(store_id=None):
    basket = prepare_transactions_from_bills(store_id=store_id)
    if basket.empty:
        return []

    baskets = []
    for bill_id, row in basket.iterrows():
        product_ids = [column for column, present in row.items() if int(present) == 1]
        baskets.append({
            "bill_id": int(bill_id),
            "products": product_ids,
        })

    return baskets
