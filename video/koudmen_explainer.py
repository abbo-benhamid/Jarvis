"""Vidéo explicative Koudmen (style 3Blue1Brown), rendue avec Manim.

Usage : voir video/README.md. La durée de chaque scène suit la narration
(durations.json produit par la synthèse vocale Piper).
"""
import json
import os

from manim import *

BG = "#0c1a19"
FG = "#e4efed"
MUTED = "#9db5b1"
SEA = "#4cc3b5"
SUN = "#f0bd4f"
HIB = "#ef6f86"
LEAF = "#7cc47f"
FONT = "DejaVu Sans"
PAD = 1.0  # silence ajouté après chaque narration

DUR = json.load(open(os.environ.get("KOUDMEN_DURATIONS", "durations.json")))

config.background_color = BG


def T(s, size=36, color=FG, weight=NORMAL):
    return Text(s, font=FONT, font_size=size, color=color, weight=weight)


def box(label, sub=None, color=SEA, w=3.6, h=1.3, fill=False):
    r = RoundedRectangle(corner_radius=0.18, width=w, height=h, color=color, stroke_width=3)
    if fill:
        r.set_fill(color, opacity=1)
    t = T(label, 28, BG if fill else FG, BOLD)
    g = VGroup(t)
    if sub:
        g.add(T(sub, 18, BG if fill else MUTED))
        g.arrange(DOWN, buff=0.12)
    g.move_to(r)
    return VGroup(r, g)


class Koudmen(Scene):
    def budget(self, key):
        self._left = DUR[key] + PAD

    def play_t(self, *a, run_time=1.0, **kw):
        self.play(*a, run_time=run_time, **kw)
        self._left -= run_time

    def pause(self, t):
        if t > 0.05:
            self.wait(t)

    def finish(self, fade=True):
        self.pause(self._left - (0.6 if fade else 0))
        if fade:
            self.play(*[FadeOut(m) for m in self.mobjects], run_time=0.6)

    def madras(self):
        cols = [HIB, SUN, SEA, LEAF]
        widths = [1.2, 0.8, 0.75, 0.4]
        g = VGroup()
        x = 0
        while x < 14.5:
            for c, w in zip(cols, widths):
                g.add(Rectangle(width=w, height=0.1, stroke_width=0, fill_color=c, fill_opacity=1).move_to([x - 7.2 + w / 2, 0, 0]))
                x += w
        return g

    def construct(self):
        # 1 — Intro
        self.budget("intro")
        paris = VGroup(Dot(color=SEA, radius=0.12), T("Paris", 26, SEA)).arrange(DOWN).move_to(LEFT * 4.5 + UP * 0.6)
        mq = VGroup(Dot(color=SUN, radius=0.12), T("Martinique", 26, SUN)).arrange(DOWN).move_to(RIGHT * 4.5 + DOWN * 0.6)
        arc = ArcBetweenPoints(paris[0].get_center(), mq[0].get_center(), angle=-PI / 3, color=MUTED, stroke_width=2)
        arc = DashedVMobject(arc, num_dashes=40)
        self.play_t(FadeIn(paris, shift=UP * 0.2), FadeIn(mq, shift=UP * 0.2), run_time=1.2)
        self.play_t(Create(arc), run_time=1.5)
        age = T("82 ans · vit seule", 22, MUTED).next_to(mq, DOWN)
        self.play_t(FadeIn(age), run_time=0.8)
        q = T("« Est-ce que maman va bien ? »", 34, FG).to_edge(UP, buff=0.9)
        self.play_t(Write(q), run_time=1.8)
        self.pause(1.5); self._left -= 1.5
        title = T("Koudmen", 84, FG, BOLD)
        sub = T("le lakou numérique", 30, SEA)
        tg = VGroup(title, sub).arrange(DOWN, buff=0.3)
        band = self.madras().next_to(tg, DOWN, buff=0.5)
        self.play_t(FadeOut(VGroup(paris, mq, arc, age, q)), run_time=0.6)
        self.play_t(Write(title), FadeIn(sub, shift=UP * 0.2), run_time=1.4)
        self.play_t(Create(band), run_time=0.8)
        self.finish()

        # 2 — Le piège du modèle « light »
        self.budget("piege")
        h = T("Le piège du modèle « light »", 40, FG, BOLD).to_edge(UP, buff=0.6)
        self.play_t(Write(h), run_time=1.2)
        ax = Axes(x_range=[0, 4, 1], y_range=[0, 30, 10], x_length=8, y_length=4,
                  axis_config={"color": MUTED, "include_ticks": False}, y_axis_config={"include_numbers": False}).shift(DOWN * 0.6)
        base = ax.c2p(0, 0)[1]
        unit = ax.c2p(0, 1)[1] - base

        def bar(x, v, c):
            return Rectangle(width=1.4, height=v * unit, stroke_width=0, fill_color=c, fill_opacity=1).move_to([ax.c2p(x, 0)[0], base + v * unit / 2, 0])

        b1 = bar(1.1, 25, HIB)
        b2 = bar(2.9, 11.5, SEA)
        l1 = T("auto-entrepreneur\nsans autorisation", 20, MUTED).next_to(b1, DOWN, buff=0.2)
        l2 = T("CESU\navec crédit d'impôt", 20, MUTED).next_to(b2, DOWN, buff=0.2)
        n1 = T("≈ 25 €/h", 28, HIB, BOLD).next_to(b1, UP)
        n2 = T("≈ 11,5 €/h", 28, SEA, BOLD).next_to(b2, UP)
        self.play_t(Create(ax), run_time=1.0)
        self.pause(4); self._left -= 4
        self.play_t(GrowFromEdge(b1, DOWN), FadeIn(l1), run_time=1.0)
        self.play_t(FadeIn(n1), run_time=0.5)
        self.play_t(GrowFromEdge(b2, DOWN), FadeIn(l2), run_time=1.0)
        self.play_t(FadeIn(n2), run_time=0.5)
        warn = T("→ la famille part au 2ᵉ mois", 26, SUN).to_edge(RIGHT, buff=0.6).shift(UP * 0.5)
        self.pause(max(0, self._left - 3.2)); self._left = min(self._left, 3.2)
        self.play_t(FadeIn(warn, shift=UP * 0.2), run_time=0.8)
        self.finish()

        # 3 — Le pivot
        self.budget("pivot")
        h = T("Le pivot", 40, FG, BOLD).to_edge(UP, buff=0.6)
        self.play_t(Write(h), run_time=0.8)
        old = T("vendre des heures", 34, MUTED).shift(UP * 0.8)
        strike = Line(old.get_left(), old.get_right(), color=HIB, stroke_width=4)
        new = T("vendre la tranquillité", 44, SEA, BOLD).shift(DOWN * 0.6)
        n = VGroup(T("~100 000", 52, SUN, BOLD), T("familles de la diaspora\navec un parent âgé au pays", 22, MUTED)).arrange(RIGHT, buff=0.4).to_edge(DOWN, buff=0.7)
        self.pause(1.5); self._left -= 1.5
        self.play_t(FadeIn(n, shift=UP * 0.2), run_time=1.0)
        self.pause(2.5); self._left -= 2.5
        self.play_t(FadeIn(old), run_time=0.7)
        self.play_t(Create(strike), run_time=0.6)
        self.play_t(Write(new), run_time=1.2)
        self.finish()

        # 4 — Les flux
        self.budget("flux")
        fam = box("Famille", "diaspora · payeur", SEA).move_to(LEFT * 4.6)
        kd = box("Koudmen", "outil · preuve", SEA, fill=True).move_to(UP * 2.1)
        acc = box("Accompagnant", "AE SAP ou salarié CESU", FG, w=4.0).move_to(DOWN * 2.1)
        aine = box("Aîné", "confirme la visite", FG).move_to(RIGHT * 4.6)
        self.play_t(*[FadeIn(b) for b in (fam, kd, acc, aine)], run_time=1.0)

        def arrow(a, b, c, label, side):
            ar = Arrow(a, b, color=c, buff=0.15, stroke_width=5, max_tip_length_to_length_ratio=0.1)
            d = b - a
            n = np.array([-d[1], d[0], 0]) / np.linalg.norm(d)
            lb = T(label, 22, c).move_to((a + b) / 2 + n * 0.55 * side)
            return VGroup(ar, lb)

        f1 = arrow(fam.get_top() + LEFT * 0.7, kd.get_left() + UP * 0.25, SUN, "abonnement", 1)
        f4 = arrow(kd.get_left() + DOWN * 0.35, fam.get_top() + RIGHT * 0.9, SEA, "journal Kayé", -1)
        f2 = arrow(fam.get_bottom() + RIGHT * 0.2, acc.get_left(), SUN, "heures −50 %", -1)
        f3 = arrow(acc.get_right(), aine.get_bottom(), HIB, "visite", -1)
        f4[1].move_to(f4[0].get_center() + RIGHT * 0.95 + DOWN * 0.25)
        f2[1].move_to(f2[0].get_center() + LEFT * 1.25 + DOWN * 0.25)
        f5 = DashedLine(aine.get_top(), kd.get_right(), color=SEA, stroke_width=3)
        f5l = T("preuve 2/3", 20, SEA).move_to((aine.get_top() + kd.get_right()) / 2 + UR * 0.35)
        self.pause(1.0); self._left -= 1.0
        self.play_t(GrowArrow(f2[0]), FadeIn(f2[1]), run_time=1.2)
        self.pause(1.8); self._left -= 1.8
        self.play_t(GrowArrow(f1[0]), FadeIn(f1[1]), run_time=1.0)
        zero = T("0 € prélevé sur l'accompagnant", 22, LEAF).next_to(acc, DOWN, buff=0.2)
        self.pause(0.8); self._left -= 0.8
        self.play_t(FadeIn(zero), run_time=0.8)
        self.pause(1.0); self._left -= 1.0
        self.play_t(GrowArrow(f3[0]), FadeIn(f3[1]), run_time=0.9)
        self.play_t(Create(f5), FadeIn(f5l), run_time=0.8)
        self.play_t(GrowArrow(f4[0]), FadeIn(f4[1]), run_time=1.0)
        self.finish()

        # 5 — La preuve de visite
        self.budget("preuve")
        h = T("La preuve de visite", 40, FG, BOLD).to_edge(UP, buff=0.6)
        self.play_t(Write(h), run_time=1.0)
        labels = [("GPS", "à l'arrivée"), ("Tag NFC / QR", "au domicile"), ("L'aîné", "« tapez 1 »")]
        circles = VGroup()
        for i, (a, b) in enumerate(labels):
            c = Circle(radius=1.35, color=MUTED, stroke_width=4)
            g = VGroup(c, VGroup(T(a, 22, FG, BOLD), T(b, 18, MUTED)).arrange(DOWN, buff=0.1))
            g.move_to([(i - 1) * 3.9, 0.2, 0])
            circles.add(g)
        self.pause(2.0); self._left -= 2.0
        self.play_t(LaggedStart(*[FadeIn(c, scale=0.8) for c in circles], lag_ratio=0.4), run_time=1.8)
        self.pause(2.5); self._left -= 2.5
        self.play_t(circles[0][0].animate.set_stroke(LEAF, 7), run_time=0.6)
        self.play_t(circles[2][0].animate.set_stroke(LEAF, 7), run_time=0.6)
        ok = VGroup(T("2 / 3  →  visite validée", 32, LEAF, BOLD), T("paiement libéré · journal envoyé", 22, MUTED)).arrange(DOWN, buff=0.15).to_edge(DOWN, buff=0.6)
        self.play_t(FadeIn(ok, shift=UP * 0.2), run_time=0.8)
        self.finish()

        # 6 — Qui peut faire le job
        self.budget("statuts")
        h = T("Qui peut faire le job ?", 40, FG, BOLD).to_edge(UP, buff=0.6)
        self.play_t(Write(h), run_time=1.0)
        people = VGroup(*[T(p, 26, SUN) for p in ("étudiant", "retraité", "voisin", "aidant familial")]).arrange(RIGHT, buff=0.7).shift(UP * 1.6)
        self.play_t(LaggedStart(*[FadeIn(p, shift=DOWN * 0.2) for p in people], lag_ratio=0.3), run_time=1.6)
        rows = [("1 · Lien", "tous statuts vérifiés", LEAF),
                ("2 · Coups de main", "salarié CESU ou AE déclaré SAP", LEAF),
                ("3 · Présence", "salarié CESU ou SAAD partenaire", SUN),
                ("4 · Aide renforcée", "SAAD partenaire uniquement", HIB)]
        ladder = VGroup()
        for a, b, c in rows:
            r = VGroup(T(a, 24, c, BOLD), T(b, 22, FG)).arrange(RIGHT, buff=0.5)
            ladder.add(r)
        ladder.arrange(DOWN, aligned_edge=LEFT, buff=0.32).shift(DOWN * 0.9)
        cesu = T("particulier = salarié de la famille (CESU)", 22, SEA).next_to(people, DOWN, buff=0.35)
        self.pause(1.5); self._left -= 1.5
        self.play_t(FadeIn(cesu), run_time=0.8)
        self.pause(1.5); self._left -= 1.5
        self.play_t(LaggedStart(*[FadeIn(r, shift=RIGHT * 0.3) for r in ladder], lag_ratio=0.35), run_time=2.0)
        self.finish()

        # 7 — La suite
        self.budget("suite")
        steps = [("J30", "avis juridique\n30 entretiens", SEA), ("S12", "go / no-go\n25 familles", HIB),
                 ("M8", "MVP codé", SEA), ("M12", "agrément", SEA)]
        line = Line(LEFT * 5.5, RIGHT * 5.5, color=MUTED, stroke_width=3).shift(UP * 0.8)
        self.play_t(Create(line), run_time=0.8)
        marks = VGroup()
        for i, (w, d, c) in enumerate(steps):
            x = -4.5 + i * 3.0
            m = VGroup(Dot([x, 0.8, 0], color=c, radius=0.13), T(w, 26, c, BOLD).move_to([x, 1.35, 0]), T(d, 18, FG).move_to([x, 0.05, 0]))
            marks.add(m)
        self.play_t(LaggedStart(*[FadeIn(m, shift=UP * 0.2) for m in marks], lag_ratio=0.5), run_time=3.0)
        self.pause(max(0, self._left - 4.0)); self._left = min(self._left, 4.0)
        end = VGroup(T("Koudmen", 60, FG, BOLD), T("Ici et là-bas, nous veillons ensemble.", 28, SEA)).arrange(DOWN, buff=0.25).shift(DOWN * 2.0)
        self.play_t(FadeIn(end, shift=UP * 0.2), run_time=1.0)
        self.finish(fade=False)
