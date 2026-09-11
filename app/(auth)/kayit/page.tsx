import { Suspense } from "react";
import { SignupForm } from "./signup-form";
import { PageHead } from "@/components/plan/room";
import { DUTIES } from "@/lib/duties";

export default function SignupPage() {
  return (
    <>
      <PageHead
        tag="Kayıt"
        figure={`${DUTIES.length} GÖREV`}
        title="Asambleye kaydolun"
        lead="Görevinizi ve paketinizi seçin, bilgilerinizi bırakın. Kaydınızı daha sonra bu panelden takip edebilirsiniz."
      />
      <Suspense>
        <SignupForm />
      </Suspense>
    </>
  );
}
