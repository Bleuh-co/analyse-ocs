import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-server";
import UploadClient from "./UploadClient";

// L'import de données OCS est réservé aux Gestionnaire+ : un Consulter (membre)
// ne voit pas l'onglet (NavBar) et, s'il tente l'URL directe, est redirigé vers
// le tableau de bord. Les routes /api/upload/* sont déjà gardées par
// requireGestionnaire — cette garde de page évite d'afficher l'UI d'import.
export default async function UploadPage() {
  const s = await getSession();
  if (!s || (s.role !== "gestionnaire" && s.role !== "admin" && s.role !== "superadmin")) {
    redirect("/dashboard");
  }
  return <UploadClient />;
}
