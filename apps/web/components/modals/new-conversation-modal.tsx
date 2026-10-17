"use client";
import { t } from "@nimchat/i18n";
import { useModal } from "@/hooks/use-modal-store";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
export function NewConversationModal(){
  const {isOpen,type,onClose,onOpen}=useModal();
  return <Dialog open={isOpen&&type==="newConversation"} onOpenChange={onClose}><DialogContent className="bg-[#0F172A] text-slate-100">
    <DialogHeader><DialogTitle>{t("New conversation")}</DialogTitle></DialogHeader>
    <div className="space-y-3">
      <button type="button" onClick={()=>onOpen("newDM")} className="block min-h-[64px] w-full rounded-xl border border-[#334155] bg-[#1A2338] p-3 text-left"><strong>{t("Direct message")}</strong><span className="block text-xs text-slate-400">{t("Find by username")}</span></button>
      <button type="button" onClick={()=>onOpen("createRoom")} className="block min-h-[64px] w-full rounded-xl border border-[#334155] bg-[#1A2338] p-3 text-left"><strong>{t("Create room")}</strong><span className="block text-xs text-slate-400">{t("Bring people and agents together")}</span></button>
    </div>
  </DialogContent></Dialog>;
}
