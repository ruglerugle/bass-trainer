# 楽器トレーナーのキャラクターを表情・ポーズ別の SVG に書き出す（ドラム・ギター・ベース・ヴォーカル共通）
# 使い方: py design/gen_chara.py  → img/chara/*.svg（置いてあるリポジトリのフォルダ名で楽器を選ぶ）
#         py design/gen_chara.py all <ClaudeCodeフォルダ>  → 4サイトまとめて書き出す
# 読譜トレーナー（sight-reading/design/gen_chara.py）と同じ描き方：
# まるい体に大きく低めの目、短い手足。線は一定の太さ、影はくっきりしたセル塗り1段＋光。
# 体の色はサイトのテーマ色の反対側にして、テーマ色のカードの上でも埋もれないようにする
import sys
from pathlib import Path

KINDS: dict[str, dict[str, str | int]] = {
    # ドラム：スネアドラムの子（テーマ＝朱色 → 体は水色）
    'drum-trainer': dict(kind='drum', ink='#2a1d33', light='#8ae3f7', base='#4cc3e6', shade='#2b9fc8', eye='#2f8fd1', crown_dy=-8),
    # ギター：ピックの子（テーマ＝緑 → 体はコーラル）
    'guitar-trainer': dict(kind='pick', ink='#1c3430', light='#ffb08f', base='#ff8a63', shade='#e5623d', eye='#1fae8c', crown_dy=-16),
    # ベース：ヘ音記号の子（テーマ＝緑 → 体はラベンダー）
    'bass-trainer': dict(kind='clef', ink='#1c3430', light='#d3c4ff', base='#ad92ff', shade='#8b6cec', eye='#1fae8c', crown_dy=0),
    # ヴォーカル：マイクの子（テーマ＝赤紫 → 体はミント）
    'vocal-trainer': dict(kind='mic', ink='#3a1a2c', light='#9ff3d0', base='#5fdcab', shade='#35b788', eye='#e0569a', crown_dy=-20),
}

FLAT_HEAD = '<ellipse cx="100" cy="154" rx="58" ry="49" transform="rotate(-8 100 154)"'
DRUM = '<path d="M40 116 A60 15 0 0 0 160 116 V188 A60 15 0 0 1 40 188 Z"'
PICK = '<path d="M100 214 C 80 204 44 182 42 140 C 40 106 66 92 100 92 C 134 92 160 106 158 140 C 156 182 120 204 100 214 Z"'
MIC = '<circle cx="100" cy="146" r="56"'
BODY_SHAPE = {'drum': DRUM, 'pick': PICK, 'clef': FLAT_HEAD, 'mic': MIC}


def make(c: dict[str, str | int]) -> dict[str, str]:
    """1つの楽器ぶんの部品を、その色で組み立てる"""
    ink, base, shade, kind = str(c['ink']), str(c['base']), str(c['shade']), str(c['kind'])
    body = BODY_SHAPE[kind]

    def limb(d: str, end: tuple[float, float], r: float = 8.5, fist: bool = False) -> str:
        x, y = end
        hand = f'<circle cx="{x}" cy="{y}" r="{r}" fill="{base}" stroke="{ink}" stroke-width="3.5"/>'
        if fist:
            hand += f'<path d="M{x - 3.5} {y - 2} q3.5 3 7 0" stroke="{ink}" stroke-width="2" fill="none" stroke-linecap="round"/>'
        return (f'<path d="{d}" stroke="{ink}" stroke-width="14" stroke-linecap="round" fill="none"/>'
                f'<path d="{d}" stroke="{base}" stroke-width="8" stroke-linecap="round" fill="none"/>' + hand)

    arms = {
        'down': limb('M47 170 q-10 9 -15 22', (31, 194)) + limb('M151 172 q10 9 15 22', (167, 196)),
        'wave': limb('M47 170 q-10 9 -15 22', (31, 194)) + limb('M154 162 q12 -6 16 -24', (172, 134)),
        'up': limb('M48 160 q-12 -8 -12 -26', (36, 130)) + limb('M154 160 q14 -8 16 -28', (172, 128)),
        'point': limb('M47 170 q-10 9 -15 22', (31, 194)) + limb('M154 166 q10 -2 20 -8', (176, 156))
        + f'<path d="M182 152 l9 -5" stroke="{ink}" stroke-width="9" stroke-linecap="round"/><path d="M182 152 l9 -5" stroke="{base}" stroke-width="4" stroke-linecap="round"/>',
        'fists': limb('M54 174 q-4 10 8 14', (62, 188), fist=True) + limb('M146 174 q4 10 -8 14', (138, 188), fist=True),
    }

    def big_eye(x: float, y: float, rx: float = 7, ry: float = 9) -> str:
        return (f'<ellipse cx="{x}" cy="{y}" rx="{rx}" ry="{ry}" fill="url(#ge)"/>'
                f'<ellipse cx="{x + 2}" cy="{y - 3.4}" rx="3" ry="3.4" fill="#fff"/><circle cx="{x - 2.4}" cy="{y + 3.6}" r="1.4" fill="#fff" opacity=".9"/>')

    eyes = {
        'dot': big_eye(82, 152) + big_eye(118, 152),
        'happy': ''.join(f'<path d="M{x - 7} 155 q7 -11 14 0" stroke="{ink}" stroke-width="4.5" stroke-linecap="round" fill="none"/>' for x in (82, 118)),
        'worried': big_eye(82, 154, 6.5, 8) + big_eye(118, 154, 6.5, 8)
        + f'<path d="M73 140 l12 -4 M127 140 l-12 -4" stroke="{ink}" stroke-width="3.2" stroke-linecap="round"/>',
    }
    mouth = {
        'open': f'<path d="M94 165 q6 11 12 0 z" fill="#c73a5a" stroke="{ink}" stroke-width="3" stroke-linejoin="round"/><path d="M97 170.5 q3 -2.5 6 0 q-3 2.6 -6 0z" fill="#ff8fa8"/>',
        'smile': f'<path d="M95 166 q5 5 10 0" stroke="{ink}" stroke-width="3.5" stroke-linecap="round" fill="none"/>',
        'wavy': f'<path d="M92 168 q3 -4 6 0 q3 4 6 0 q3 -4 6 0" stroke="{ink}" stroke-width="3" stroke-linecap="round" fill="none"/>',
    }

    def sparkle(x: float, y: float, s: float, color: str = '#ffcf4d') -> str:
        return (f'<path d="M{x} {y - s} Q{x + s * .2} {y - s * .2} {x + s} {y} Q{x + s * .2} {y + s * .2} {x} {y + s} '
                f'Q{x - s * .2} {y + s * .2} {x - s} {y} Q{x - s * .2} {y - s * .2} {x} {y - s}z" fill="{color}" stroke="{ink}" stroke-width="2.5" stroke-linejoin="round"/>')

    def mini_note(x: float, y: float) -> str:
        return (f'<ellipse cx="{x}" cy="{y}" rx="7" ry="5.5" fill="#fff" stroke="{ink}" stroke-width="2.5" transform="rotate(-20 {x} {y})"/>'
                f'<path d="M{x + 6} {y - 2} v-20" stroke="{ink}" stroke-width="2.8" stroke-linecap="round"/>')

    sweat = f'<path d="M38 118 c4 6 7 10 7 13 a7 7 0 0 1 -14 0 c0 -3 3 -7 7 -13z" fill="#9bd7ff" stroke="{ink}" stroke-width="2.5"/>'
    crown = (f'<g transform="translate(0 {c["crown_dy"]}) rotate(-12 84 100)"><path d="M64 112 l4 -20 l9 11 l7 -15 l7 15 l9 -11 l4 20 z" fill="#fff2b3" stroke="{ink}" stroke-width="3.5" stroke-linejoin="round"/>'
             f'<circle cx="84" cy="106" r="3.2" fill="#ff6b8a" stroke="{ink}" stroke-width="2"/></g>')
    pink = '#ff7aa2'
    poses = {
        'hello': ('dot', 'open', 'wave', sparkle(36, 80, 9) + mini_note(204, 178)),
        'happy': ('happy', 'open', 'down', sparkle(36, 90, 10) + sparkle(204, 160, 7, pink)),
        'celebrate': ('happy', 'open', 'up', sparkle(22, 176, 10) + sparkle(206, 182, 9, pink) + sparkle(194, 66, 8) + mini_note(34, 80)),
        'cheer': ('dot', 'smile', 'fists', sparkle(196, 132, 7)),
        'worried': ('worried', 'wavy', 'fists', sweat),
        'guide': ('dot', 'smile', 'point', ''),
        'crown': ('happy', 'smile', 'wave', crown + sparkle(26, 160, 8) + sparkle(206, 100, 7)),
    }

    # 楽器ごとの部品：back＝体の後ろ、detail＝体の上（影と同じく体の形で切り抜く）、over＝輪郭のあと
    back = detail = over = ''
    if kind == 'drum':
        wood, wood_d = '#f6d49a', '#d9a75c'
        for d in ('M58 52 L132 124', 'M142 52 L68 124'):  # 交差したスティック
            back += (f'<path d="{d}" stroke="{ink}" stroke-width="13" stroke-linecap="round"/>'
                     f'<path d="{d}" stroke="{wood}" stroke-width="7" stroke-linecap="round"/>')
        back += ''.join(f'<ellipse cx="{x}" cy="51" rx="7" ry="6" fill="{wood}" stroke="{ink}" stroke-width="3.5"/>' for x in (57, 143))
        detail = (f'<rect x="30" y="176" width="140" height="40" fill="#e9eef7"/>'  # 下のリム（銀）
                  f'<path d="M30 176 H170" stroke="{ink}" stroke-width="3"/>'
                  + ''.join(f'<rect x="{x - 3}" y="128" width="6" height="48" rx="3" fill="#e9eef7" stroke="{ink}" stroke-width="2.5"/>' for x in (52, 148)))
        over = (f'<ellipse cx="100" cy="116" rx="60" ry="15" fill="#fffaf0" stroke="{ink}" stroke-width="5"/>'  # 打面
                f'<path d="M62 118 q38 10 76 0" stroke="#efe2c9" stroke-width="4" stroke-linecap="round" fill="none"/>'
                f'<path d="M72 112 q14 -4 28 -5" stroke="#fff" stroke-width="3" stroke-linecap="round" fill="none"/>')
        hl = '<path d="M56 136 v16" stroke="#fff" stroke-width="5" stroke-linecap="round"/><circle cx="56" cy="162" r="2.6" fill="#fff"/>'
    elif kind == 'pick':
        hl = '<path d="M56 126 q6 -18 26 -24" stroke="#fff" stroke-width="6" stroke-linecap="round" fill="none"/><circle cx="52" cy="141" r="3.2" fill="#fff"/>'
    elif kind == 'clef':
        # ヘ音記号のうず：頭から上へ回って、細くなりながら左下へ抜ける
        tail = 'M92 108 C 146 70 208 94 204 148 C 200 186 168 206 112 216 C 154 198 184 180 186 148 C 188 112 152 94 110 116 Z'
        back = (f'<path d="{tail}" fill="url(#gb)" stroke="{ink}" stroke-width="4.5" stroke-linejoin="round"/>'
                f'<path d="M168 96 C 186 104 196 120 197 140" stroke="#fff" stroke-width="4" stroke-linecap="round" fill="none" opacity=".8"/>')
        over = ''.join(f'<circle cx="214" cy="{y}" r="7" fill="{base}" stroke="{ink}" stroke-width="3.5"/>' for y in (122, 160))
        hl = '<path d="M58 140 q6 -15 24 -22" stroke="#fff" stroke-width="6" stroke-linecap="round" fill="none"/><circle cx="54" cy="155" r="3.2" fill="#fff"/>'
    else:  # mic
        back = (f'<path d="M80 186 L86 212 Q100 219 114 212 L120 186 Z" fill="#4a3d5c" stroke="{ink}" stroke-width="4" stroke-linejoin="round"/>'
                f'<path d="M90 196 l3 14" stroke="#8a7aa3" stroke-width="3" stroke-linecap="round"/>'
                f'<ellipse cx="100" cy="190" rx="26" ry="7" fill="#e9eef7" stroke="{ink}" stroke-width="3.5"/>')
        hatch = ''.join(f'<path d="M{x} 86 l40 40" stroke="{ink}" stroke-width="1.6" opacity=".22"/><path d="M{x + 40} 86 l-40 40" stroke="{ink}" stroke-width="1.6" opacity=".22"/>'
                        for x in range(30, 180, 12))
        detail = f'<path d="M30 80 H170 V124 Q100 108 30 124 Z" fill="{shade}" opacity=".55"/>{hatch}'
        over = f'<path d="M47 124 Q100 106 153 124" stroke="{ink}" stroke-width="3.5" fill="none" stroke-linecap="round"/>'
        hl = '<path d="M62 106 q12 -12 30 -14" stroke="#fff" stroke-width="5.5" stroke-linecap="round" fill="none"/><circle cx="56" cy="148" r="3.2" fill="#fff"/>'

    defs = (f'<linearGradient id="gb" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="{c["light"]}"/><stop offset="1" stop-color="{base}"/></linearGradient>'
            f'<linearGradient id="ge" x1="0" y1="0" x2="0" y2="1"><stop offset=".35" stop-color="{ink}"/><stop offset="1" stop-color="{c["eye"]}"/></linearGradient>'
            '<radialGradient id="gc"><stop offset="0" stop-color="#ff7a9a" stop-opacity=".85"/><stop offset="1" stop-color="#ff7a9a" stop-opacity="0"/></radialGradient>'
            f'<clipPath id="c">{body}/></clipPath>')
    feet = ''.join(f'<ellipse cx="{x}" cy="202" rx="13" ry="8.5" fill="{base}" stroke="{ink}" stroke-width="3.5"/>'
                   f'<path d="M{x - 7} 206 q7 3 14 0" stroke="{shade}" stroke-width="3" stroke-linecap="round" fill="none"/>' for x in (80, 120))
    torso = (f'{body} fill="url(#gb)"/>'
             f'<g clip-path="url(#c)">{detail}<path d="M168 120 C 160 176 120 200 60 204 L 180 220 Z" fill="{shade}" opacity=".7"/></g>'
             f'{body} fill="none" stroke="{ink}" stroke-width="5" stroke-linejoin="round"/>{over}{hl}')
    cheeks = ''.join(f'<ellipse cx="{x}" cy="166" rx="11" ry="7" fill="url(#gc)"/>' for x in (66, 134))
    out = {}
    for name, (e, m, a, deco) in poses.items():
        out[name] = ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="10 30 210 190">'
                     f'<defs>{defs}</defs><ellipse cx="100" cy="213" rx="38" ry="6" fill="#1e1b3a" opacity=".18"/>'
                     f'{back}{feet}{arms[a]}{torso}{cheeks}{eyes[e]}{mouth[m]}{deco}</svg>')
    return out


def write(repo: Path) -> None:
    out = repo / 'img' / 'chara'
    out.mkdir(parents=True, exist_ok=True)
    files = make(KINDS[repo.name])
    for name, s in files.items():
        (out / f'{name}.svg').write_text(s, encoding='utf-8')
    print(f'{repo.name}: {len(files)} files -> {out}')


def main() -> None:
    if len(sys.argv) >= 3 and sys.argv[1] == 'all':
        for name in KINDS:
            write(Path(sys.argv[2]) / name)
        return
    repo = Path(__file__).resolve().parent.parent
    if repo.name not in KINDS:
        raise SystemExit(f'{repo.name} はキャラクターの対象外です（対象: {", ".join(KINDS)}）')
    write(repo)


if __name__ == '__main__':
    main()
