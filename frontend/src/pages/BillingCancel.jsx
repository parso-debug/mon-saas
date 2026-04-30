import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, X } from "lucide-react";

export default function BillingCancel() {
  return (
    <div className="min-h-screen bg-[#FAFAFA] flex items-center justify-center p-6" data-testid="billing-cancel-page">
      <div className="max-w-lg w-full bg-white border border-black/10 p-10 text-center">
        <div className="w-14 h-14 bg-[#FAFAFA] border border-black/10 mx-auto mb-6 flex items-center justify-center">
          <X className="w-6 h-6 text-[#71717A]" />
        </div>
        <h1 className="font-display font-bold text-3xl tracking-tight mb-2">Paiement annulé</h1>
        <p className="text-[#52525B] mb-8">Aucun montant n'a été débité. Vous pouvez réessayer quand vous voulez.</p>
        <div className="flex gap-3 justify-center">
          <Link to="/billing"><Button variant="outline" className="rounded-none h-12 px-6 border-black/20" data-testid="cancel-retry">Retour aux offres</Button></Link>
          <Link to="/dashboard"><Button className="rounded-none h-12 px-6 bg-[#09090B] hover:bg-[#F95A2C] text-white" data-testid="cancel-to-dashboard"><ArrowLeft className="w-4 h-4 mr-2" /> Dashboard</Button></Link>
        </div>
      </div>
    </div>
  );
}
