import smtplib
from email.message import EmailMessage

from flask import current_app


def generate_order_message(supplier_name, product_name, quantity):
    return (
        "Order Request:\n"
        f"Supplier: {supplier_name}\n"
        f"Product: {product_name}\n"
        f"Quantity: {quantity} units"
    )


def send_order_email(supplier_email, supplier_name, product_name, quantity):
    config = current_app.config
    mail_username = config.get("MAIL_USERNAME")
    mail_password = config.get("MAIL_PASSWORD")
    mail_server = config.get("MAIL_SERVER")
    mail_port = config.get("MAIL_PORT", 587)
    mail_use_tls = config.get("MAIL_USE_TLS", True)
    default_sender = config.get("MAIL_DEFAULT_SENDER") or mail_username
    subject = "Order Request"
    message_body = generate_order_message(supplier_name, product_name, quantity)

    email_preview = {
        "to": supplier_email,
        "subject": subject,
        "body": message_body,
    }

    if not mail_username or not mail_password:
        print("Simulated Email Sent")
        return {
            "success": True,
            "mode": "demo",
            "message": "Order simulated successfully",
            "email_preview": email_preview,
        }

    if not default_sender:
        raise ValueError("Default sender email is not configured")

    email_message = EmailMessage()
    email_message["Subject"] = subject
    email_message["From"] = default_sender
    email_message["To"] = supplier_email
    email_message.set_content(message_body)

    try:
        with smtplib.SMTP(mail_server, mail_port, timeout=30) as smtp:
            if mail_use_tls:
                smtp.starttls()
            smtp.login(mail_username, mail_password)
            smtp.send_message(email_message)
    except smtplib.SMTPAuthenticationError as exc:
        raise RuntimeError("SMTP authentication failed") from exc
    except smtplib.SMTPException as exc:
        raise RuntimeError(f"SMTP error: {exc}") from exc
    except OSError as exc:
        raise RuntimeError(f"Mail server connection failed: {exc}") from exc

    return {
        "success": True,
        "mode": "smtp",
        "message": "Order email sent successfully",
        "email_preview": email_preview,
    }
