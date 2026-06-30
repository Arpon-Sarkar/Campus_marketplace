# Bug Fix Report - Orders, Bookings, Stock and Service Attachments

Fixed in this version:

1. Service attachment/PDF opening
   - Added `/api/services/:id/file` backend endpoint.
   - PDFs/DOC/DOCX/image attachments now open through the backend instead of relying only on the saved file URL.
   - Service attachment links now use a direct View link, so files can open in a new browser tab from service details, service order pages, and admin panel.

2. Product stock control
   - Product stock now decreases/reserves immediately when the seller approves the order.
   - Buyer final receiving confirmation no longer decreases stock.
   - When stock reaches zero, product status becomes `sold`.
   - If the product has pending orders equal to available stock, new buyers cannot keep placing unlimited orders.
   - Seller cannot approve more orders than available stock.

3. Buyer order cancellation
   - Added buyer cancel endpoint: `PUT /api/orders/:id/cancel`.
   - Buyer can cancel only while order status is `pending_seller_approval`.
   - After seller approval, buyer cannot cancel.

4. Student service booking cancellation
   - Added booking cancel endpoint: `PUT /api/bookings/:id/cancel`.
   - Student can cancel only while booking status is `pending_provider_approval`.
   - After provider approval, student cannot cancel.

5. Payment status UI
   - Removed “Mark Payment Unpaid” buttons from seller/provider/admin pages.
   - Paid/completed orders and bookings cannot be changed back to unpaid through the normal UI.
   - Backend also blocks marking paid/completed orders/bookings as unpaid.
