"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { CommunityPostItem } from "@/types";
import { formatDateTime } from "@/lib/utils";

export function CommunityBoard({ spotId, initialPosts, loggedIn }: { spotId: string; initialPosts: CommunityPostItem[]; loggedIn: boolean }) {
  const router = useRouter();
  const [posts, setPosts] = useState(initialPosts);
  const [form, setForm] = useState({ title: "", content: "", tags: "", type: "GUIDE" as "GUIDE" | "STORY" });
  const [message, setMessage] = useState("");
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});

  async function submitPost() {
    if (!loggedIn) {
      router.push(`/login?redirect=/spots/${spotId}`);
      return;
    }

    const response = await fetch(`/api/spots/${spotId}/posts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        tags: form.tags.split(/[|,，、]/).map((item) => item.trim()).filter(Boolean)
      })
    });
    const data = await response.json();
    if (!response.ok) {
      setMessage(data.error || "发帖失败");
      return;
    }

    setPosts((current) => [data.item, ...current]);
    setForm({ title: "", content: "", tags: "", type: "GUIDE" });
    setMessage("发帖成功，已出现在景点社区中");
    router.refresh();
  }

  async function toggleLike(postId: string) {
    const response = await fetch(`/api/posts/${postId}/like`, { method: "POST" });
    const data = await response.json();
    if (!response.ok) {
      setMessage(data.error || "点赞失败");
      return;
    }

    setPosts((current) => current.map((post) => post.id === postId ? { ...post, likedByCurrentUser: data.liked, likeCount: data.count } : post));
  }

  async function submitComment(postId: string) {
    const content = commentDrafts[postId]?.trim();
    if (!content) return;

    const response = await fetch(`/api/posts/${postId}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content })
    });
    const data = await response.json();
    if (!response.ok) {
      setMessage(data.error || "评论失败");
      return;
    }

    setPosts((current) => current.map((post) => post.id === postId ? { ...post, commentCount: post.commentCount + 1, comments: [...post.comments, data.item] } : post));
    setCommentDrafts((current) => ({ ...current, [postId]: "" }));
  }

  return (
    <section className="rounded-[1.8rem] border border-brand-100 bg-white p-5 shadow-card">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-brand-900">景点社区</h3>
          <p className="mt-1 text-sm text-slate-500">每个景点都可以沉淀攻略、踩坑提醒和拍照路线。</p>
        </div>
        <div className="rounded-full bg-brand-50 px-3 py-1 text-xs text-brand-700">{posts.length} 篇帖子</div>
      </div>
      <div className="mt-4 rounded-[1.5rem] bg-sand p-4">
        <div className="grid gap-3 md:grid-cols-[1fr,160px]">
          <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="帖子标题，例如：一日路线怎么走更顺" className="rounded-2xl border border-brand-100 px-4 py-3 text-sm" />
          <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as "GUIDE" | "STORY" })} className="rounded-2xl border border-brand-100 px-4 py-3 text-sm">
            <option value="GUIDE">攻略</option>
            <option value="STORY">帖子</option>
          </select>
        </div>
        <textarea value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} placeholder="写下你的路线、推荐机位、停车提醒或避坑经验。" className="mt-3 min-h-28 w-full rounded-2xl border border-brand-100 px-4 py-3 text-sm" />
        <div className="mt-3 grid gap-3 md:grid-cols-[1fr,140px]">
          <input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} placeholder="标签，使用 | 分隔，如 摄影|亲子|停车方便" className="rounded-2xl border border-brand-100 px-4 py-3 text-sm" />
          <button type="button" onClick={() => void submitPost()} className="rounded-2xl bg-brand-700 px-4 py-3 text-sm text-white">发布到社区</button>
        </div>
        {message ? <p className="mt-3 text-sm text-slate-500">{message}</p> : null}
      </div>
      <div className="mt-5 space-y-4">
        {posts.length === 0 ? <p className="text-sm text-slate-500">这里还没有帖子，你可以发布第一篇攻略。</p> : null}
        {posts.map((post) => (
          <article key={post.id} className="rounded-[1.5rem] border border-brand-100 p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 text-xs text-brand-700">
                  <span className="rounded-full bg-brand-50 px-2 py-1">{post.type === "GUIDE" ? "攻略" : "帖子"}</span>
                  {post.tags.slice(0, 3).map((tag) => <span key={tag}>{tag}</span>)}
                </div>
                <h4 className="mt-2 text-lg font-semibold text-brand-900">{post.title}</h4>
                <div className="mt-1 text-xs text-slate-500">{post.author.nickname} · {formatDateTime(post.createdAt)}</div>
              </div>
              <button type="button" onClick={() => void toggleLike(post.id)} className={`rounded-full px-3 py-2 text-sm ${post.likedByCurrentUser ? "bg-brand-700 text-white" : "bg-brand-50 text-brand-700"}`}>点赞 {post.likeCount}</button>
            </div>
            <p className="mt-3 text-sm leading-7 text-slate-600">{post.content}</p>
            <div className="mt-4 space-y-2 rounded-2xl bg-sand p-3">
              <div className="text-sm font-medium text-brand-900">评论区 · {post.commentCount}</div>
              {post.comments.length === 0 ? <p className="text-sm text-slate-500">还没有评论。</p> : null}
              {post.comments.map((comment) => (
                <div key={comment.id} className="rounded-xl bg-white px-3 py-2 text-sm text-slate-600">
                  <span className="font-medium text-brand-900">{comment.author.nickname}：</span>{comment.content}
                </div>
              ))}
              <div className="flex gap-2 pt-1">
                <input value={commentDrafts[post.id] || ""} onChange={(e) => setCommentDrafts((current) => ({ ...current, [post.id]: e.target.value }))} placeholder="写一句有用的提醒" className="flex-1 rounded-xl border border-brand-100 px-3 py-2 text-sm" />
                <button type="button" onClick={() => void submitComment(post.id)} className="rounded-xl bg-brand-700 px-4 py-2 text-sm text-white">评论</button>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}