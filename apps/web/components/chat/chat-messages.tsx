"use client";

import { t } from "@nimchat/i18n";
import { groupReactions, useAuthStore } from "@nimchat/sdk";
import { useMemo, useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { useSearchParams } from "next/navigation";

import { useRoom } from "@/components/chat/room-provider";
import { AgentTurn } from "@/components/chat/agent-turn";
import { ChatWelcome } from "@/components/chat/chat-welcome";
import { agentTimeline } from "@nimchat/brian/agent-timeline";
export function ChatMessages() {
  const {roomId,name,events,surfaces,trust,status,hasMore,isLoadingMore,loadMore,reload}=useRoom();
  const userId=useAuthStore((s)=>s.userId);
  const scroll=useRef<HTMLDivElement>(null);
  const content=useRef<HTMLDivElement>(null);
  const last=useRef<HTMLDivElement>(null);
  const search=useSearchParams();
  const focusEvent=search.get("focusEvent");
  const [notFound,setNotFound]=useState(false);
  const renderable=useMemo(()=>agentTimeline(events,surfaces,trust).sort((a,b)=>a.room_seq-b.room_seq),[events,surfaces,trust]);
  const reactions=useMemo(()=>groupReactions(events),[events]);
  // Focus origin is a cross-route deep link; pagination remains in RoomProvider.
  useEffect(()=>{
    if(!focusEvent || status!=="loaded")return;
    let cancel=false;
    const seek=async()=>{
      for(let i=0;i<10&&!cancel;i++){
        const target=document.getElementById("event-"+focusEvent);
        if(target){target.scrollIntoView({block:"center"});setNotFound(false);return;}
        if(!hasMore || !(await loadMore()))break;
        await new Promise(r=>setTimeout(r,50));
      }
      if(!cancel)setNotFound(true);
    };
    void seek();return()=>{cancel=true};
  },[focusEvent,status,events,hasMore,loadMore]);
  // Follow the bottom while the reader is there. Content often grows without a new row (a
  // reply joins the agent's turn, a card updates, an image loads), so this watches height.
  const pinned=useRef(true);
  const ready=events.length>0||(status!=="loading"&&status!=="error");
  useEffect(()=>{pinned.current=true},[roomId]);
  useEffect(()=>{
    const box=scroll.current,inner=content.current;
    if(!ready||!box||!inner||focusEvent)return;
    const onScroll=()=>{pinned.current=box.scrollHeight-box.scrollTop-box.clientHeight<80};
    const follow=new ResizeObserver(()=>{if(pinned.current)box.scrollTop=box.scrollHeight});
    box.addEventListener("scroll",onScroll,{passive:true});
    follow.observe(inner);follow.observe(box);
    return()=>{box.removeEventListener("scroll",onScroll);follow.disconnect()};
  },[ready,focusEvent]);
  // Sending a message brings the reader back down even after scrolling up.
  const lastSeen=useRef<string | undefined>(undefined);
  useEffect(()=>{
    const newest=renderable.at(-1)?.events.at(-1);
    const fresh=newest?.event_id!==lastSeen.current;
    lastSeen.current=newest?.event_id;
    if(focusEvent||!fresh)return;
    if(newest?.sender_id===userId)pinned.current=true;
    if(pinned.current)last.current?.scrollIntoView({block:"end"});
  },[roomId,renderable,focusEvent,userId]);
  if(status==="loading"&&!events.length)return <div className="flex flex-1 items-center justify-center"><Loader2 className="animate-spin text-violet-400"/></div>;
  if(status==="error"&&!events.length)return <div className="flex flex-1 flex-col items-center justify-center gap-3"><p>{t("Could not load the messages.")}</p><button onClick={reload} className="text-violet-300">{t("Try again")}</button></div>;
  return <div ref={scroll} className="min-h-0 flex-1 overflow-y-auto px-3 py-4 md:px-6"><div ref={content}>
    {notFound&&<p role="status" className="p-2 text-center text-amber-300">{t("The original message was not found in the loaded pages.")}</p>}
    {hasMore&&<button type="button" disabled={isLoadingMore} onClick={()=>void loadMore()} className="mb-5 w-full rounded-lg py-2 text-sm text-violet-300 hover:bg-[#1A2338]">{isLoadingMore?"Carregando...":t("Load earlier messages")}</button>}
    {!renderable.length&&<ChatWelcome name={name}/>}
    {renderable.map(row=><div key={row.key} className={row.eventIds.includes(focusEvent ?? "")?"rounded-lg ring-2 ring-violet-500/70":""}>
      {row.eventIds.map(id => <span key={id} id={"event-"+id} className={focusEvent===id?"ring-2":""}/>)}
      <AgentTurn row={row} reactions={reactions} surfaces={surfaces} trust={trust}/>
    </div>)}
    <div ref={last}/>
  </div></div>;
}
