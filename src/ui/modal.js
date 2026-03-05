import { $ } from "../utils.js";

export function openModal(title, contentNode) {
  $("modalTitle").textContent = title;
  const body = $("modalBody");
  body.innerHTML = "";
  body.appendChild(contentNode);
  $("modalWrap").classList.remove("hidden");
}

export function closeModal() {
  $("modalWrap").classList.add("hidden");
}

export function bindModal() {
  $("btnModalClose").onclick = () => closeModal();
  $("modalWrap").addEventListener("click", (e) => {
    if (e.target === $("modalWrap")) closeModal();
  });
}
