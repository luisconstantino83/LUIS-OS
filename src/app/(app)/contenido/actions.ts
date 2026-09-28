"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getContext } from "@/lib/session";
import { bool, date, dbError, num, oneOf, str } from "@/lib/form";
import { ROLES } from "@/lib/monse";
import type { ActionState } from "@/components/forms";

const STATUS = ["idea", "guion", "grabacion", "edicion", "programado", "publicado"] as const;
const PLATFORM = ["youtube", "instagram", "tiktok"] as const;
const OWNER = ["luis", "monse"] as const;
const FORMAT = ["reel", "tiktok", "short", "carrusel", "foto", "stories", "video", "vlog", "mini_doc"] as const;
const uuidOrNull = (v: string | null) => (v && /^[0-9a-f-]{36}$/i.test(v) ? v : null);

export async function createContent(_: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await getContext();
  const title = str(fd, "title", 140);
  const platform = oneOf(fd.get("platform"), PLATFORM);
  const owner = oneOf(fd.get("owner"), OWNER) ?? "luis";
  if (!title) return { error: "Escribe un título o idea." };
  if (!platform) return { error: "Elige una plataforma." };
  const { data, error } = await ctx.supabase
    .from("content_items")
    .insert({ user_id: ctx.userId, title, platform, owner, hook: str(fd, "hook", 500) })
    .select("id")
    .single();
  if (error) return { error: dbError(error) };
  revalidatePath("/", "layout");
  redirect(`/contenido/${data.id}`);
}

export async function updateContent(id: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await getContext();
  const title = str(fd, "title", 140);
  if (!title) return { error: "El título no puede ir vacío." };
  const status = oneOf(fd.get("status"), STATUS) ?? "idea";
  let published = date(fd, "published_date");
  if (status === "publicado" && !published) published = ctx.today;
  const metric = (k: string) => num(fd, k, { min: 0, max: 2_000_000_000, int: true });
  const url = str(fd, "url", 500);
  if (url && !/^https?:\/\//i.test(url)) return { error: "La URL debe empezar con http:// o https://" };
  const { error } = await ctx.supabase
    .from("content_items")
    .update({
      title,
      status,
      owner: oneOf(fd.get("owner"), OWNER) ?? "luis",
      platform: oneOf(fd.get("platform"), PLATFORM) ?? "tiktok",
      hook: str(fd, "hook", 1000),
      concept: str(fd, "concept"),
      script: str(fd, "script", 20000),
      shot_list: str(fd, "shot_list", 10000),
      caption: str(fd, "caption", 3000),
      cta: str(fd, "cta", 500),
      hashtags: str(fd, "hashtags", 1000),
      scheduled_date: date(fd, "scheduled_date"),
      published_date: published,
      url,
      views: metric("views"),
      likes: metric("likes"),
      comments: metric("comments"),
      shares: metric("shares"),
      saves: metric("saves"),
      followers_gained: num(fd, "followers_gained", { min: -1_000_000, max: 100_000_000, int: true }),
      format: oneOf(fd.get("format"), FORMAT),
      production_id: uuidOrNull(str(fd, "production_id", 36)),
      campaign_id: uuidOrNull(str(fd, "campaign_id", 36)),
      in_portfolio: bool(fd, "in_portfolio"),
      portfolio_note: str(fd, "portfolio_note", 2000),
      roles: fd.getAll("roles").filter((r): r is string => typeof r === "string" && ROLES.includes(r)),
    })
    .eq("id", id);
  if (error) return { error: dbError(error) };

  // Skills demostradas → content_skills; al estar publicada, cuenta como aplicación real.
  const skillIds = [
    ...new Set(fd.getAll("skills").filter((x): x is string => typeof x === "string" && /^[0-9a-f-]{36}$/i.test(x))),
  ];
  const { error: e1 } = await ctx.supabase.from("content_skills").delete().eq("content_id", id);
  if (e1) return { error: dbError(e1) };
  if (skillIds.length) {
    const { error: e2 } = await ctx.supabase
      .from("content_skills")
      .insert(skillIds.map((skill_id) => ({ content_id: id, user_id: ctx.userId, skill_id })));
    if (e2) return { error: dbError(e2) };
    if (status === "publicado") {
      const { error: e3 } = await ctx.supabase.from("skill_evidence").upsert(
        skillIds.map((skill_id) => ({
          user_id: ctx.userId,
          skill_id,
          kind: "apply",
          content_id: id,
          title,
          url,
          occurred_on: published && published <= ctx.today ? published : ctx.today,
        })),
        { onConflict: "skill_id,kind,content_id", ignoreDuplicates: true },
      );
      if (e3) return { error: dbError(e3) };
    }
  }
  revalidatePath("/", "layout");
  return {
    ok: true,
    message: status === "publicado" && skillIds.length ? `Guardado. Evidencia registrada en ${skillIds.length} skills.` : "Guardado.",
  };
}

export async function deleteContent(id: string) {
  const ctx = await getContext();
  await ctx.supabase.from("content_items").delete().eq("id", id);
  revalidatePath("/", "layout");
  redirect("/contenido");
}
