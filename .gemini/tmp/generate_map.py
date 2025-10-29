raw_headers_str = 'order_id,order_number,order_date,paid_date,status,shipping_total,shipping_tax_total,fee_total,fee_tax_total,tax_total,cart_discount,order_discount,discount_total,order_total,order_subtotal,order_currency,payment_method,payment_method_title,transaction_id,customer_ip_address,customer_user_agent,shipping_method,customer_id,customer_user,customer_email,billing_first_name,billing_last_name,billing_company,billing_email,billing_phone,billing_address_1,billing_address_2,billing_postcode,billing_city,billing_state,billing_country,shipping_first_name,shipping_last_name,shipping_company,shipping_phone,shipping_address_1,shipping_address_2,shipping_postcode,shipping_city,shipping_state,shipping_country,customer_note,wt_import_key,shipping_items,fee_items,tax_items,coupon_items,refund_items,order_notes,download_permissions,meta:wpml_language,line_item_1,line_item_2,line_item_3,line_item_4,line_item_5,line_item_6,line_item_7,line_item_8,line_item_9,line_item_10,line_item_11,line_item_12,line_item_13,line_item_14,line_item_15,line_item_16,line_item_17,line_item_18,line_item_19,line_item_20,line_item_21,line_item_22,line_item_23,line_item_24,"Product Item 1 Name","Product Item 1 id","Product Item 1 SKU","Product Item 1 Quantity","Product Item 1 Total","Product Item 1 Subtotal","Product Item 2 Name","Product Item 2 id","Product Item 2 SKU","Product Item 2 Quantity","Product Item 2 Total","Product Item 2 Subtotal","Product Item 3 Name","Product Item 3 id","Product Item 3 SKU","Product Item 3 Quantity","Product Item 3 Total","Product Item 3 Subtotal","Product Item 4 Name","Product Item 4 id","Product Item 4 SKU","Product Item 4 Quantity","Product Item 4 Total","Product Item 4 Subtotal","Product Item 5 Name","Product Item 5 id","Product Item 5 SKU","Product Item 5 Quantity","Product Item 5 Total","Product Item 5 Subtotal","Product Item 6 Name","Product Item 6 id","Product Item 6 SKU","Product Item 6 Quantity","Product Item 6 Total","Product Item 6 Subtotal","Product Item 7 Name","Product Item 7 id","Product Item 7 SKU","Product Item 7 Quantity","Product Item 7 Total","Product Item 7 Subtotal","Product Item 8 Name","Product Item 8 id","Product Item 8 SKU","Product Item 8 Quantity","Product Item 8 Total","Product Item 8 Subtotal","Product Item 9 Name","Product Item 9 id","Product Item 9 SKU","Product Item 9 Quantity","Product Item 9 Total","Product Item 9 Subtotal","Product Item 10 Name","Product Item 10 id","Product Item 10 SKU","Product Item 10 Quantity","Product Item 10 Total","Product Item 10 Subtotal","Product Item 11 Name","Product Item 11 id","Product Item 11 SKU","Product Item 11 Quantity","Product Item 11 Total","Product Item 11 Subtotal","Product Item 12 Name","Product Item 12 id","Product Item 12 SKU","Product Item 12 Quantity","Product Item 12 Total","Product Item 12 Subtotal","Product Item 13 Name","Product Item 13 id","Product Item 13 SKU","Product Item 13 Quantity","Product Item 13 Total","Product Item 13 Subtotal","Product Item 14 Name","Product Item 14 id","Product Item 14 SKU","Product Item 14 Quantity","Product Item 14 Total","Product Item 14 Subtotal","Product Item 15 Name","Product Item 15 id","Product Item 15 SKU","Product Item 15 Quantity","Product Item 15 Total","Product Item 15 Subtotal","Product Item 16 Name","Product Item 16 id","Product Item 16 SKU","Product Item 16 Quantity","Product Item 16 Total","Product Item 16 Subtotal","Product Item 17 Name","Product Item 17 id","Product Item 17 SKU","Product Item 17 Quantity","Product Item 17 Total","Product Item 17 Subtotal","Product Item 18 Name","Product Item 18 id","Product Item 18 SKU","Product Item 18 Quantity","Product Item 18 Total","Product Item 18 Subtotal","Product Item 19 Name","Product Item 19 id","Product Item 19 SKU","Product Item 19 Quantity","Product Item 19 Total","Product Item 19 Subtotal","Product Item 20 Name","Product Item 20 id","Product Item 20 SKU","Product Item 20 Quantity","Product Item 20 Total","Product Item 20 Subtotal","Product Item 21 Name","Product Item 21 id","Product Item 21 SKU","Product Item 21 Quantity","Product Item 21 Total","Product Item 21 Subtotal","Product Item 22 Name","Product Item 22 id","Product Item 22 SKU","Product Item 22 Quantity","Product Item 22 Total","Product Item 22 Subtotal","Product Item 23 Name","Product Item 23 id","Product Item 23 SKU","Product Item 23 Quantity","Product Item 23 Total","Product Item 23 Subtotal","Product Item 24 Name","Product Item 24 id","Product Item 24 SKU","Product Item 24 Quantity","Product Item 24 Total","Product Item 24 Subtotal"'

raw_headers = []
in_quote = False
current_header = []
for char in raw_headers_str:
    if char == '"' or char == "'": # Handle both single and double quotes
        in_quote = not in_quote
    elif char == ',' and not in_quote:
        raw_headers.append("".join(current_header).strip())
        current_header = []
    else:
        current_header.append(char)
raw_headers.append("".join(current_header).strip()) # Add the last header

mapping_lines = []
for header in raw_headers:
    # Standardize the header name to wos_ format
    # Remove quotes, replace spaces/colons with underscores, convert to lowercase
    wos_header_base = header.replace(' ', '_').replace(':', '_').replace('"', '').lower()
    
    # Apply specific mappings for common fields
    if wos_header_base == 'order_id':
        wos_header = 'wos_OrderId'
    elif wos_header_base == 'order_number':
        wos_header = 'wos_OrderNumber'
    elif wos_header_base == 'order_date':
        wos_header = 'wos_OrderDate'
    elif wos_header_base == 'paid_date':
        wos_header = 'wos_PaidDate'
    elif wos_header_base == 'status':
        wos_header = 'wos_Status'
    elif wos_header_base == 'shipping_total':
        wos_header = 'wos_ShippingTotal'
    elif wos_header_base == 'shipping_tax_total':
        wos_header = 'wos_ShippingTaxTotal'
    elif wos_header_base == 'fee_total':
        wos_header = 'wos_FeeTotal'
    elif wos_header_base == 'fee_tax_total':
        wos_header = 'wos_FeeTaxTotal'
    elif wos_header_base == 'tax_total':
        wos_header = 'wos_TaxTotal'
    elif wos_header_base == 'cart_discount':
        wos_header = 'wos_CartDiscount'
    elif wos_header_base == 'order_discount':
        wos_header = 'wos_OrderDiscount'
    elif wos_header_base == 'discount_total':
        wos_header = 'wos_DiscountTotal'
    elif wos_header_base == 'order_total':
        wos_header = 'wos_OrderTotal'
    elif wos_header_base == 'order_subtotal':
        wos_header = 'wos_OrderSubtotal'
    elif wos_header_base == 'order_currency':
        wos_header = 'wos_OrderCurrency'
    elif wos_header_base == 'payment_method':
        wos_header = 'wos_PaymentMethod'
    elif wos_header_base == 'payment_method_title':
        wos_header = 'wos_PaymentMethodTitle'
    elif wos_header_base == 'transaction_id':
        wos_header = 'wos_TransactionId'
    elif wos_header_base == 'customer_ip_address':
        wos_header = 'wos_CustomerIpAddress'
    elif wos_header_base == 'customer_user_agent':
        wos_header = 'wos_CustomerUserAgent'
    elif wos_header_base == 'shipping_method':
        wos_header = 'wos_ShippingMethod'
    elif wos_header_base == 'customer_id':
        wos_header = 'wos_CustomerId'
    elif wos_header_base == 'customer_user':
        wos_header = 'wos_CustomerUser'
    elif wos_header_base == 'customer_email':
        wos_header = 'wos_CustomerEmail'
    elif wos_header_base == 'billing_first_name':
        wos_header = 'wos_BillingFirstName'
    elif wos_header_base == 'billing_last_name':
        wos_header = 'wos_BillingLastName'
    elif wos_header_base == 'billing_company':
        wos_header = 'wos_BillingCompany'
    elif wos_header_base == 'billing_email':
        wos_header = 'wos_BillingEmail'
    elif wos_header_base == 'billing_phone':
        wos_header = 'wos_BillingPhone'
    elif wos_header_base == 'billing_address_1':
        wos_header = 'wos_BillingAddress1'
    elif wos_header_base == 'billing_address_2':
        wos_header = 'wos_BillingAddress2'
    elif wos_header_base == 'billing_postcode':
        wos_header = 'wos_BillingPostcode'
    elif wos_header_base == 'billing_city':
        wos_header = 'wos_BillingCity'
    elif wos_header_base == 'billing_state':
        wos_header = 'wos_BillingState'
    elif wos_header_base == 'billing_country':
        wos_header = 'wos_BillingCountry'
    elif wos_header_base == 'shipping_first_name':
        wos_header = 'wos_ShippingFirstName'
    elif wos_header_base == 'shipping_last_name':
        wos_header = 'wos_ShippingLastName'
    elif wos_header_base == 'shipping_company':
        wos_header = 'wos_ShippingCompany'
    elif wos_header_base == 'shipping_phone':
        wos_header = 'wos_ShippingPhone'
    elif wos_header_base == 'shipping_address_1':
        wos_header = 'wos_ShippingAddress1'
    elif wos_header_base == 'shipping_address_2':
        wos_header = 'wos_ShippingAddress2'
    elif wos_header_base == 'shipping_postcode':
        wos_header = 'wos_ShippingPostcode'
    elif wos_header_base == 'shipping_city':
        wos_header = 'wos_ShippingCity'
    elif wos_header_base == 'shipping_state':
        wos_header = 'wos_ShippingState'
    elif wos_header_base == 'shipping_country':
        wos_header = 'wos_ShippingCountry'
    elif wos_header_base == 'customer_note':
        wos_header = 'wos_CustomerNote'
    elif wos_header_base == 'wt_import_key':
        wos_header = 'wos_WtImportKey'
    elif wos_header_base == 'shipping_items':
        wos_header = 'wos_ShippingItems'
    elif wos_header_base == 'fee_items':
        wos_header = 'wos_FeeItems'
    elif wos_header_base == 'tax_items':
        wos_header = 'wos_TaxItems'
    elif wos_header_base == 'coupon_items':
        wos_header = 'wos_CouponItems'
    elif wos_header_base == 'refund_items':
        wos_header = 'wos_RefundItems'
    elif wos_header_base == 'order_notes':
        wos_header = 'wos_OrderNotes'
    elif wos_header_base == 'download_permissions':
        wos_header = 'wos_DownloadPermissions'
    elif wos_header_base == 'meta_wpml_language':
        wos_header = 'wos_MetaWpmlLanguage'
    elif wos_header_base.startswith('line_item_'):
        wos_header = f"wos_{wos_header_base.replace('line_item_', 'LineItem')}"
    elif wos_header_base.startswith('product_item_'):
        # Example: product_item_1_name -> wos_ProductItem1Name
        parts = wos_header_base.split('_')
        item_num = parts[2]
        item_field = "_".join(parts[3:])
        wos_header = f"wos_ProductItem{item_num}{item_field.capitalize()}"
    else:
        wos_header = f"wos_{wos_header_base}"
    
    mapping_lines.append(f"        ['map.web.order_columns', 'Maps WooCommerce CSV headers to internal field names for staging.', 'stable', '{header}', '{wos_header}', '', '', '', '', '', '', '', ''],")

for line in mapping_lines:
    print(line)
