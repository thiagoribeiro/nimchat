"use client";
import { t } from "@nimchat/i18n";
import { MessageCircle } from "lucide-react";
import { useModal } from "@/hooks/use-modal-store";
import { MobileToggle } from "@/components/mobile-toggle";
export default function MainPage(){
 const onOpen=useModal(s=>s.onOpen);
 return <div className="relative flex h-full flex-col items-center justify-center gap-4 bg-[#0B1222] px-6 text-center text-slate-300">
  <div className="absolute left-4 top-4 md:hidden"><MobileToggle /></div>
  <MessageCircle className="text-violet-300" size={42}/>
  <h1 className="text-xl font-semibold">{t("Welcome to NimChat")}</h1>
  <p className="max-w-md text-sm text-slate-400">{t("Talk to people and agents. Open the surfaces inside each conversation.")}</p>
  <button type="button" className="min-h-[44px] rounded-xl bg-violet-600 px-5 text-sm text-white" onClick={()=>onOpen("newConversation")}>{t("New conversation")}</button>
 </div>;
}
