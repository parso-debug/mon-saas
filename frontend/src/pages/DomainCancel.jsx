import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { XCircle } from "lucide-react";

export default function DomainCancel() {
  return (
    <div className="min-h-screen bg-[#FAFAFA] flex items-center justify-center px-4" data-testid="domain-cancel">
      <div className="bg-white border border-black/10 p-10 max-w-md w-full text-center">
        <XCircle className="w-10 h-10 mx-auto text-[#71717A]" />
        <h1 className="font-display font-bold text-2xl tracking-tight mt-4">Achat annulé</h1>
        <p className="text-[#52525B] mt-2 font-manrope text-sm">Aucun débit n'a été effectué. Vous pouvez reprendre votre recherche quand vous voulez.</p>
        <Link to="/domains" className="inline-block mt-6">
          <Button className="rounded-none bg-[#09090B] hover:bg-[#F95A2C] text-white" data-testid="domain-cancel-retry">Retour à la recherche</Button>
        </Link>
      </div>
    </div>
  );
}
