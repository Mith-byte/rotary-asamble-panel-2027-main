import { EmailLoginForm } from "./email-login-form";
import { PageHead } from "@/components/plan/room";

export default function LoginPage() {
  return (
    <>
      <PageHead
        tag="Giriş"
        title="Kayıt panelinize girin"
        lead="E-posta adresinizi girin. Size tek kullanımlık bir kod göndereceğiz — şifre gerekmiyor."
      />
      <EmailLoginForm />
    </>
  );
}
