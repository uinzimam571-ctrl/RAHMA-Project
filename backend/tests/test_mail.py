import ssl
from email.message import EmailMessage
from unittest.mock import patch

from app.config import Settings
from app.mail import deliver


def test_local_emails_are_saved_as_private_files(tmp_path):
    settings = Settings(
        jwt_secret="test-only-secret-with-at-least-32-characters",
        email_directory=tmp_path,
        mail_backend="file",
    )
    message = EmailMessage()
    message["To"] = "person@example.com"
    message["Subject"] = "Verification"
    message.set_content("Open your verification link.")
    deliver(settings, message)
    files = list(tmp_path.glob("*.txt"))
    assert len(files) == 1
    assert "Open your verification link." in files[0].read_text()


def test_optional_smtp_uses_verified_tls():
    settings = Settings(
        jwt_secret="test-only-secret-with-at-least-32-characters",
        mail_backend="smtp",
        smtp_starttls=True,
        smtp_username="smtp-test",
        smtp_password="test-only-mail-password",
    )
    message = EmailMessage()
    message["To"] = "person@example.com"
    message.set_content("Test email")
    with patch("app.mail.smtplib.SMTP") as server:
        deliver(settings, message)
        smtp = server.return_value.__enter__.return_value
        context = smtp.starttls.call_args.kwargs["context"]
        assert context.verify_mode == ssl.CERT_REQUIRED and context.check_hostname
        smtp.send_message.assert_called_once()
