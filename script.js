// Vanilla JS só — sem framework, sem dependência externa (mesma filosofia
// do resto do site: leve, sem build step, fácil de hospedar em qualquer lugar).
(function () {
  "use strict";

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- Efeito de digitação: papéis no hero ---------- */
  var roles = [
    "Desenvolvimento de Software",
    "Sites Personalizados",
    "Sites em WordPress",
    "SEO Técnico",
    "Backend & APIs",
  ];
  var roleEl = document.getElementById("heroRole");

  function typeLoop() {
    if (!roleEl || reduceMotion) {
      if (roleEl) roleEl.textContent = roles[0];
      return;
    }
    var roleIndex = 0;
    var charIndex = 0;
    var deleting = false;

    function tick() {
      var current = roles[roleIndex];
      if (!deleting) {
        charIndex++;
        roleEl.textContent = current.slice(0, charIndex);
        if (charIndex === current.length) {
          deleting = true;
          return setTimeout(tick, 1800);
        }
        return setTimeout(tick, 55);
      }
      charIndex--;
      roleEl.textContent = current.slice(0, charIndex);
      if (charIndex === 0) {
        deleting = false;
        roleIndex = (roleIndex + 1) % roles.length;
        return setTimeout(tick, 300);
      }
      return setTimeout(tick, 28);
    }
    tick();
  }
  typeLoop();

  /* ---------- Efeito de digitação: bloco de código do hero ----------
     Digita caractere a caractere (não token por token) com atraso
     variável e pausas maiores depois de vírgula/chave/quebra de linha —
     dá a sensação de alguém digitando de verdade, sem precisar de uma
     biblioteca como GSAP só para isso. Preserva os <span> de realce de
     sintaxe: só o texto dentro deles é esvaziado e "redigitado". */
  var codeEl = document.getElementById("typedCode");
  if (codeEl && !reduceMotion) {
    var sourceHTML = codeEl.innerHTML;
    var plainText = codeEl.textContent;
    codeEl.setAttribute("aria-label", plainText);

    var template = document.createElement("div");
    template.innerHTML = sourceHTML;
    codeEl.innerHTML = "";
    while (template.firstChild) {
      codeEl.appendChild(template.firstChild);
    }

    var walker = document.createTreeWalker(codeEl, NodeFilter.SHOW_TEXT);
    var textNodes = [];
    var node;
    while ((node = walker.nextNode())) {
      textNodes.push({ el: node, text: node.data });
      node.data = "";
    }

    var ti = 0;
    var ci = 0;

    function typeChar() {
      if (ti >= textNodes.length) return;
      var current = textNodes[ti];
      if (ci >= current.text.length) {
        ti++;
        ci = 0;
        setTimeout(typeChar, 70);
        return;
      }
      var char = current.text[ci++];
      current.el.data += char;

      var delay = 18 + Math.random() * 45;
      if (char === "\n") delay += 220;
      else if (",;{}".indexOf(char) !== -1) delay += 90;
      setTimeout(typeChar, delay);
    }
    setTimeout(typeChar, 400);
  }

  /* ---------- Revelação ao rolar (IntersectionObserver) ----------
     rootMargin generoso + threshold 0: sem isso, um clique num link do
     menu (que pula direto pra âncora) ou uma rolagem rápida pode passar
     por cima de uma seção sem nunca contar como "interseção", deixando
     o conteúdo (que começa com opacity:0) invisível para sempre. */
  var revealEls = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window && !reduceMotion) {
    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("in-view");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0, rootMargin: "150px 0px 150px 0px" }
    );
    revealEls.forEach(function (el) {
      observer.observe(el);
    });

    // Reforço: ao navegar direto para uma âncora (clique no menu ou o
    // hash já vir na URL), revela na hora tudo que existir dentro da
    // seção de destino, sem depender do observer conseguir "ver" a
    // seção no meio do salto instantâneo do navegador.
    function revealSection(hash) {
      if (!hash) return;
      var target = document.querySelector(hash);
      if (!target) return;
      target.querySelectorAll(".reveal").forEach(function (el) {
        el.classList.add("in-view");
        observer.unobserve(el);
      });
    }
    document.querySelectorAll('a[href^="#"]').forEach(function (link) {
      link.addEventListener("click", function () {
        revealSection(link.getAttribute("href"));
      });
    });
    revealSection(window.location.hash);
  } else {
    revealEls.forEach(function (el) {
      el.classList.add("in-view");
    });
  }

  /* ---------- Brilho seguindo o cursor (só telas com mouse) ---------- */
  var hasFinePointer = window.matchMedia("(pointer: fine)").matches;
  if (hasFinePointer && !reduceMotion) {
    var glow = document.createElement("div");
    glow.className = "cursor-glow";
    glow.style.opacity = "0";
    document.body.appendChild(glow);

    var rafId = null;
    document.addEventListener("mousemove", function (e) {
      if (rafId) return;
      rafId = requestAnimationFrame(function () {
        glow.style.opacity = "1";
        glow.style.left = e.clientX + "px";
        glow.style.top = e.clientY + "px";
        rafId = null;
      });
    });
    document.addEventListener("mouseleave", function () {
      glow.style.opacity = "0";
    });
  }

  /* ---------- Formulário de contato ----------
     Sem backend próprio (site 100% estático). Se `data-endpoint` estiver
     preenchido no <form>, manda um POST em JSON pra lá (Formspree, um
     webhook do n8n, uma função serverless — qualquer coisa que aceite
     JSON e responda 2xx). Sem endpoint configurado, ou se o envio falhar,
     cai para abrir o e-mail já preenchido — nunca deixa a pessoa sem
     conseguir mandar a mensagem. */
  var contactForm = document.getElementById("contactForm");
  if (contactForm) {
    contactForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var status = contactForm.querySelector(".form-status");
      var data = new FormData(contactForm);
      var payload = {
        name: data.get("name"),
        email: data.get("email"),
        message: data.get("message"),
      };
      var endpoint = contactForm.dataset.endpoint;

      function openMailFallback() {
        var subject = encodeURIComponent("Contato pelo site — " + payload.name);
        var body = encodeURIComponent(payload.message + "\n\n" + payload.email);
        window.location.href =
          "mailto:eduardo.junior1@uscsonline.com.br?subject=" + subject + "&body=" + body;
        status.textContent = "Abrindo seu e-mail com a mensagem preenchida...";
      }

      if (!endpoint) {
        openMailFallback();
        return;
      }

      status.textContent = "Enviando...";
      fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
        .then(function (res) {
          if (!res.ok) throw new Error("Falha no envio");
          status.textContent = "Mensagem enviada! Retorno em breve.";
          contactForm.reset();
        })
        .catch(openMailFallback);
    });
  }

  /* ---------- Menu mobile: trava o scroll do fundo enquanto aberto ----------
     Mesmo comportamento do site-estetica-main: sem isto, dava pra rolar a
     página por trás do menu deslizado, o que quebra a sensação de "painel
     modal". O 'change' cobre quando o próprio ícone de hambúrguer abre/
     fecha; like o clique num link e o pageshow (voltar pelo histórico do
     navegador) mudam o .checked via JS, que não dispara 'change' sozinho,
     então cada um reseta o overflow explicitamente também. */
  var menuCheckbox = document.getElementById("menuToggle");
  if (menuCheckbox) {
    menuCheckbox.checked = false;
    document.body.style.overflow = "";
    menuCheckbox.addEventListener("change", function () {
      document.body.style.overflow = menuCheckbox.checked ? "hidden" : "";
    });
    window.addEventListener("pageshow", function () {
      menuCheckbox.checked = false;
      document.body.style.overflow = "";
    });
  }

  /* ---------- Fecha o menu mobile ao clicar num link ---------- */
  document.querySelectorAll("nav a").forEach(function (link) {
    link.addEventListener("click", function () {
      if (menuCheckbox) menuCheckbox.checked = false;
      document.body.style.overflow = "";
    });
  });

  /* ---------- Ano no rodapé ---------- */
  var yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();
})();
