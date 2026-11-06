import asyncio
import smtplib
import ssl
from email.message import EmailMessage
from uuid import uuid4

from fastapi import HTTPException


def deliver(settings, message):
    """Save local emails as files, or send through an optional SMTP account."""
    if settings.mail_backend == "file":
        settings.email_directory.mkdir(parents=True, exist_ok=True)
        destination = settings.email_directory / f"{uuid4()}.txt"
        destination.write_text(
            f"To: {message['To']}\nSubject: {message['Subject']}\n\n{message.get_content()}",
            encoding="utf-8",
        )
        return
    with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=10) as smtp:
        if settings.smtp_starttls:
            smtp.starttls(context=ssl.create_default_context())
        if settings.smtp_username:
            smtp.login(
                settings.smtp_username, settings.smtp_password.get_secret_value()
            )
        smtp.send_message(message)


async def send_account_email(settings, email, kind, link):
    message = EmailMessage()
    title = (
        "Verify your RAHMA email" if kind == "verify" else "Reset your RAHMA password"
    )
    lifetime = "24 hours" if kind == "verify" else "10 minutes"
    message["From"] = settings.mail_from
    message["To"] = email
    message["Subject"] = title
    message.set_content(
        f"{title}\n\nOpen this link to continue:\n{link}\n\n"
        f"This link expires in {lifetime} and can only be used once.\n"
        "If you did not request this, ignore this email.\n\nRAHMA"
    )
    try:
        await asyncio.to_thread(deliver, settings, message)
    except (OSError, smtplib.SMTPException):
        raise HTTPException(
            503,
            "Email could not be sent. Please try again using the resend or recovery form.",
        ) from None
