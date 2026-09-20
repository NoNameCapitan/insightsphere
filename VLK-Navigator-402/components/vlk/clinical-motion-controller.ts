/** Presentation-only DOM controller; no application state, timers or storage.
 * Kept independent of React so the actual event lifecycle can be browser-tested.
 */
export function attachClinicalMotion(root: HTMLElement): () => void {
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
  const fine = window.matchMedia("(hover: hover)");
  const selector = ".specialty-card";
  let active: HTMLElement | null = null;
  const returns = new Set<Animation>();
  root.dataset.motionManaged = "true";

  const targetFor = (target: EventTarget | null) =>
    target instanceof Element ? target.closest<HTMLElement>(selector) : null;
  const contextual = (animation: Animation) =>
    animation instanceof CSSAnimation && /^(si-|clinical-signature|brand-)/.test(animation.animationName);
  const snapshot = (element: Element) => {
    const style = getComputedStyle(element);
    return {
      transform: style.transform,
      opacity: style.opacity,
      stroke: style.stroke,
      strokeDashoffset: style.strokeDashoffset,
      filter: style.filter,
    };
  };

  function cancelReturns() {
    for (const animation of returns) {
      animation.onfinish = null;
      animation.oncancel = null;
      animation.cancel();
    }
    returns.clear();
  }

  function settle(smooth = true) {
    cancelReturns();
    if (!active) return;
    const previous = active;
    const elements = new Set<Element>();
    // Read all start frames before writing, then read all destinations together.
    if (smooth && !reduced.matches && previous.isConnected) {
      for (const animation of previous.getAnimations({ subtree: true })) {
        if (!contextual(animation)) continue;
        const effect = animation.effect;
        if (effect instanceof KeyframeEffect && effect.target && effect.target !== previous) {
          elements.add(effect.target);
        }
      }
    }
    const frames = [...elements].map((element) => ({ element, from: snapshot(element) }));
    delete previous.dataset.motionActive;
    active = null;
    if (!smooth || reduced.matches) return;
    const destinations = frames
      .filter(({ element }) => element.isConnected)
      .map(({ element, from }) => ({ element, from, to: snapshot(element) }));
    for (const { element, from, to } of destinations) {
      const animation = element.animate([from, to], {
        duration: 180,
        easing: "cubic-bezier(.2,.7,.2,1)",
      });
      returns.add(animation);
      const release = () => { returns.delete(animation); };
      animation.onfinish = release;
      animation.oncancel = release;
    }
  }

  function begin(target: HTMLElement | null) {
    if (!target || !root.contains(target) || reduced.matches || target === active) return;
    if (root.querySelector("[data-snake-running]")) return;
    settle(false);
    active = target;
    active.dataset.motionActive = "true";
  }

  const pointerOver = (event: PointerEvent) => {
    const target = targetFor(event.target);
    // Enter the card, not each child. Moving icon → text → arrow never restarts it.
    if (fine.matches && event.pointerType !== "touch" && targetFor(event.relatedTarget) !== target) {
      begin(target);
    }
  };
  const pointerOut = (event: PointerEvent) => {
    if (active && targetFor(event.target) === active && targetFor(event.relatedTarget) !== active) {
      settle();
    }
  };
  const focusIn = (event: FocusEvent) => begin(targetFor(event.target));
  const focusOut = (event: FocusEvent) => {
    if (active && targetFor(event.target) === active && targetFor(event.relatedTarget) !== active) {
      settle();
    }
  };
  const pointerDown = (event: PointerEvent) => {
    const target = targetFor(event.target);
    if (!target) settle(false);
    else if (event.pointerType === "touch") begin(target);
    // Do not preventDefault or capture clicks: one tap still selects immediately.
  };
  const stop = () => settle(false);
  const animationComplete = (event: AnimationEvent) => {
    if (!active || targetFor(event.target) !== active) return;
    if (!/^(si-|clinical-signature|brand-)/.test(event.animationName)) return;
    // The 1100ms signature must not end the longer specialty sequence.
    const running = active.getAnimations({ subtree: true }).some((animation) =>
      contextual(animation) && (animation.playState === "running" || animation.pending),
    );
    if (!running) settle(false);
  };
  const visibilityChange = () => { if (document.hidden) stop(); };
  // A selection can unmount a card before its animation emits animationend.
  const observer = new MutationObserver(() => {
    if (active && !root.contains(active)) stop();
  });
  observer.observe(root, { childList: true, subtree: true });

  root.addEventListener("pointerover", pointerOver);
  root.addEventListener("pointerout", pointerOut);
  root.addEventListener("focusin", focusIn);
  root.addEventListener("focusout", focusOut);
  root.addEventListener("pointerdown", pointerDown);
  root.addEventListener("pointercancel", stop);
  root.addEventListener("animationend", animationComplete);
  root.addEventListener("animationcancel", animationComplete);
  reduced.addEventListener("change", stop);
  window.addEventListener("blur", stop);
  document.addEventListener("visibilitychange", visibilityChange);

  return () => {
    observer.disconnect();
    settle(false);
    delete root.dataset.motionManaged;
    root.removeEventListener("pointerover", pointerOver);
    root.removeEventListener("pointerout", pointerOut);
    root.removeEventListener("focusin", focusIn);
    root.removeEventListener("focusout", focusOut);
    root.removeEventListener("pointerdown", pointerDown);
    root.removeEventListener("pointercancel", stop);
    root.removeEventListener("animationend", animationComplete);
    root.removeEventListener("animationcancel", animationComplete);
    reduced.removeEventListener("change", stop);
    window.removeEventListener("blur", stop);
    document.removeEventListener("visibilitychange", visibilityChange);
  };
}
