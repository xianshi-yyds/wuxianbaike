import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import {
  ArrowRight,
  BookOpenCheck,
  BrainCircuit,
  Compass,
  Database,
  ImageIcon,
  Layers3,
  MousePointerClick,
  Sparkles,
} from "lucide-react";

export const metadata: Metadata = {
  title: "AI 无限百科 | 可点击的视觉知识地图",
  description:
    "AI 无限百科把想法或图片生成可点击、可讲解、可继续深入探索的视觉知识地图。",
  alternates: {
    canonical: "/",
  },
};

const modes = [
  {
    title: "无限探索",
    description: "输入主题或上传图片，生成可点击的视觉知识地图，并沿着局部继续深入。",
    icon: Compass,
  },
  {
    title: "精选百科",
    description: "预置动物、历史、城市、科技主题，适合快速展示知识地图的完整体验。",
    icon: BookOpenCheck,
  },
  {
    title: "自主学习",
    description: "按年龄段、教材版本和学习场景调整讲解深度，让探索路径更适合学习。",
    icon: BrainCircuit,
  },
  {
    title: "百科编辑器",
    description: "面向机构内容生产，把素材整理成可讲解、可复用的视觉百科内容。",
    icon: Layers3,
  },
];

const strengths = [
  {
    title: "图片即入口",
    description: "用户可以点击画面任意区域，把局部变成下一层知识页。",
    icon: MousePointerClick,
  },
  {
    title: "内容可回看",
    description: "账号登录后保存生成记录，继续探索时能从历史路径接着走。",
    icon: Database,
  },
  {
    title: "资源本地化",
    description: "生成图保存到服务器，减少外链图片在国内网络下的加载失败。",
    icon: ImageIcon,
  },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-[#f7f2e9] text-stone-950">
      <section className="relative min-h-[92svh] overflow-hidden border-b border-stone-300">
        <Image
          src="/generated-images/curated/homepage-hero-snow-leopard.png"
          alt="雪豹视觉百科示例"
          fill
          priority
          sizes="100vw"
          className="object-cover"
        />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(10,14,12,0.74)_0%,rgba(18,24,22,0.52)_42%,rgba(18,24,22,0.12)_72%),linear-gradient(180deg,rgba(10,14,12,0.18)_0%,rgba(10,14,12,0.62)_100%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.06)_1px,transparent_1px)] bg-[length:52px_52px]" />

        <header className="relative z-10 mx-auto flex max-w-7xl items-center justify-between px-5 py-5 lg:px-8">
          <Link href="/" className="flex items-center gap-3 text-white" aria-label="AI 无限百科首页">
            <span className="grid h-11 w-11 place-items-center rounded-md border border-white/35 bg-white/12 backdrop-blur">
              <Sparkles size={20} />
            </span>
            <span>
              <span className="block text-base font-semibold leading-5">AI 无限百科</span>
              <span className="block text-xs uppercase tracking-[0.18em] text-white/66">
                Visual Knowledge Atlas
              </span>
            </span>
          </Link>
          <nav className="hidden items-center gap-2 rounded-md border border-white/20 bg-white/12 p-1 text-sm font-semibold text-white/82 backdrop-blur md:flex">
            <Link className="rounded px-3 py-2 transition hover:bg-white/14 hover:text-white" href="#modes">
              功能
            </Link>
            <Link className="rounded px-3 py-2 transition hover:bg-white/14 hover:text-white" href="#use-cases">
              场景
            </Link>
            <Link className="rounded px-3 py-2 transition hover:bg-white/14 hover:text-white" href="/open.html">
              演示
            </Link>
          </nav>
        </header>

        <div className="relative z-10 mx-auto flex min-h-[calc(92svh-84px)] max-w-7xl items-center px-5 pb-16 pt-6 lg:px-8">
          <div className="max-w-3xl">
            <p className="inline-flex items-center gap-2 rounded-full border border-white/28 bg-white/12 px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-white/78 backdrop-blur">
              <Sparkles size={14} />
              visual knowledge atlas
            </p>
            <h1 className="mt-7 max-w-4xl text-5xl font-semibold leading-[1.02] tracking-normal text-white md:text-7xl lg:text-8xl">
              AI 无限百科
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-white/82 md:text-xl">
              输入一个想法或上传一张图片，生成一张可点击、可讲解、可继续深入探索的 AI 视觉知识地图。
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/infinite-explore"
                className="inline-flex h-12 items-center justify-center gap-2 rounded-md bg-white px-5 text-sm font-semibold text-stone-950 shadow-[0_18px_48px_rgba(0,0,0,0.22)] transition hover:bg-amber-100"
              >
                开始自由探索
                <ArrowRight size={17} />
              </Link>
              <Link
                href="/open.html"
                className="inline-flex h-12 items-center justify-center gap-2 rounded-md border border-white/30 bg-white/10 px-5 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/18"
              >
                浏览官网演示
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section id="modes" className="border-b border-stone-300 bg-[#f4efe5] px-5 py-14 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-800">
                core modules
              </p>
              <h2 className="mt-3 text-3xl font-semibold tracking-normal text-stone-950 md:text-5xl">
                从官网入口直接进入可用模块
              </h2>
            </div>
            <p className="max-w-xl text-sm leading-7 text-stone-600">
              首页保留品牌和场景说明，把复杂演示页拆到模块内，减少首屏加载压力，也让用户更快理解产品。
            </p>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {modes.map((mode) => (
              <article
                key={mode.title}
                className="rounded-lg border border-stone-300 bg-[#fffaf2] p-5 shadow-[0_18px_50px_rgba(70,55,35,0.08)]"
              >
                <mode.icon className="text-teal-800" size={24} />
                <h3 className="mt-5 text-xl font-semibold text-stone-950">{mode.title}</h3>
                <p className="mt-3 text-sm leading-7 text-stone-600">{mode.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="use-cases" className="bg-[#eef3f1] px-5 py-14 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[0.82fr_1fr] lg:items-center">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-stone-500">
              why it matters
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-normal text-stone-950 md:text-5xl">
              它不是普通搜索页，而是能继续走下去的知识界面。
            </h2>
            <p className="mt-5 text-base leading-8 text-stone-600">
              官网首屏负责建立信任和说明价值，核心操作交给无限探索模块。这样既适合对外展示，也不会让第一次访问就下载整套演示数据。
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-1">
            {strengths.map((item) => (
              <article
                key={item.title}
                className="flex gap-4 rounded-lg border border-teal-900/12 bg-white/72 p-5 shadow-[0_16px_44px_rgba(31,56,50,0.08)]"
              >
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-md bg-teal-900 text-white">
                  <item.icon size={20} />
                </span>
                <span>
                  <h3 className="text-lg font-semibold text-stone-950">{item.title}</h3>
                  <p className="mt-2 text-sm leading-7 text-stone-600">{item.description}</p>
                </span>
              </article>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
