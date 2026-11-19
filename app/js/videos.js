// Jeff Nippard video page (#/videos) (FE-13: out of main.js).
import { $, esc, ic, toast } from "./ui.js";
import { setTop } from "./nav.js";
import { onImg } from "./components.js";

const view = $("#view");
const VIDEOS = [
  ["Tier lists", [["fGm-ef-4PVk", "Chest"], ["jLvqKgW-_G8", "Back"], ["SgyUoY0IZ7A", "Shoulders"], ["GNO4OtYoCYk", "Biceps"], ["OpRMRhr0Ycc", "Triceps"], ["kIXcoivzGf8", "Quads"], ["3ryh7PNhz3E", "Glutes"]]],
  ["Best of Jeff", [["S6rqpxVGKZ4", "The Only 25 Exercises You Ever Need"], ["qpRGnTTcLpo", "7 Amazing Exercises No One Does (All S-Tier)"], ["928aRhhPP8I", "The Upper Body Workout (1-Year Transformation)"],
    ["hRZ5MM6gmlE", "The Leg Workout (1-Year Transformation)"], ["MT9ZeE5JJsI", "7 Things That Helped My Shoulders Grow"], ["Tn-XvYG9x7w", "Get Abs In 60 Days"]]],
];
export function videos() {
  setTop({ title: "Jeff Nippard", back: true });
  view.innerHTML = `${navigator.onLine ? "" : `<div class="notice warn">${ic("alert", "sm")}<span>You're offline — these videos need internet. Exercise demos still work.</span></div>`}
    ${VIDEOS.map(([h, vs]) => `<div class="sec"><h2>${h}</h2></div><div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(240px,1fr))">
      ${vs.map(([id, t]) => `<button class="xcard" data-id="${id}" style="border:0;padding:0;text-align:start;color:inherit"><div class="ph" style="aspect-ratio:16/9"><img data-fade src="https://i.ytimg.com/vi/${id}/hqdefault.jpg" alt="" loading="lazy"></div>
        <div class="meta"><div class="name" style="min-height:0">${h === "Tier lists" ? `Best & worst ${t} exercises` : esc(t)}</div></div></button>`).join("")}</div>`).join("")}`;
  onImg(view);
  view.onclick = (e) => {
    const c = e.target.closest("[data-id]"); if (!c || c.querySelector("iframe")) return;
    if (!navigator.onLine) return toast("Needs internet");
    c.firstElementChild.innerHTML = `<iframe src="https://www.youtube-nocookie.com/embed/${c.dataset.id}?autoplay=1&playsinline=1&rel=0" style="position:absolute;inset:0;width:100%;height:100%;border:0" referrerpolicy="strict-origin-when-cross-origin" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe>`;
  };
}
