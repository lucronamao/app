#!/usr/bin/env python3
"""Monta as pastas de acesso do Lucro na Mao.

POR QUE ISTO EXISTE (31/08/2026, e o custo foi uma cliente tentando 5 vezes):

No fluxo Compartilhar > Adicionar a Tela de Inicio do Safari, o iOS decide a URL do
icone a partir da pagina ABERTA. Se a compradora estiver num app de /app/ (o gesto
natural, ela ja esta usando o app), o manifest de /app/ manda start_url `hub.html`,
que NAO tem chave de acesso no caminho. O icone nasce travado, e nao ha como
recuperar: no iPhone o app instalado tem storage SEPARADO do Safari, entao lembrar o
nivel no navegador nao chega dentro do icone.

A unica coisa que sempre funciona e a chave estar no CAMINHO. Entao toda pagina que a
compradora possa ter aberta precisa existir sob /app/<chave>/. Este script gera essas
copias a partir de UMA fonte (os arquivos da raiz), pra nao existir versao divergente.

Uso:  python montar-pastas.py
Depois: publicar a pasta inteira em lucronamao/app.
"""
import json, os, re, shutil

RAIZ = os.path.dirname(os.path.abspath(__file__))
APPS = ['index.html', 'divulga.html', 'precificacao.html']
MENU = 'hub.html'          # o menu, que vira o index.html de cada pasta
BASE = 'https://lucronamao.github.io/app/'

# chave -> o que ela libera. Fonte unica desta tabela no projeto.
NIVEIS = {
    'c':    ['controle'],
    'd':    ['divulga'],
    'p':    ['preco'],
    'cd':   ['controle', 'divulga'],
    'cp':   ['controle', 'preco'],   # compatibilidade
    'u':    ['preco'],               # compatibilidade
    'tudo': ['controle', 'divulga', 'preco'],
}

def manifest(chave):
    """start_url e scope da PROPRIA pasta: e isso que faz o icone nascer liberado."""
    return {
        'name': 'Lucro na Mão',
        'short_name': 'Lucro na Mão',
        'description': 'Controle da Lojinha: vendas, estoque e lucro na palma da mão.',
        'start_url': BASE + chave + '/',
        'scope': BASE,
        'display': 'standalone',
        'orientation': 'portrait',
        'background_color': '#fdf4f8',
        'theme_color': '#8e2757',
        'icons': [
            {'src': BASE + 'favicon-96.png', 'sizes': '96x96', 'type': 'image/png'},
            {'src': BASE + 'icone-192.png', 'sizes': '192x192', 'type': 'image/png', 'purpose': 'any'},
            {'src': BASE + 'icone-512.png', 'sizes': '512x512', 'type': 'image/png', 'purpose': 'any'},
            {'src': BASE + 'icone-512.png', 'sizes': '512x512', 'type': 'image/png', 'purpose': 'maskable'},
        ],
    }

def ajustar(html, dentro_da_pasta):
    """Dentro da pasta, os assets moram um nivel acima."""
    if not dentro_da_pasta:
        return html
    # imagens, icones e o service worker ficam em /app/, nao em /app/<chave>/
    for a in ['favicon-16.png','favicon-32.png','favicon-48.png','favicon-96.png',
              'favicon-180.png','icone-192.png','icone-512.png',
              'logo-branca.png','logo-vinho.png']:
        html = html.replace('"' + a + '"', '"../' + a + '"')
        html = html.replace("'" + a + "'", "'../" + a + "'")
    return html

def main():
    for chave in NIVEIS:
        pasta = os.path.join(RAIZ, chave)
        os.makedirs(pasta, exist_ok=True)

        # o menu vira o index.html da pasta
        origem = os.path.join(RAIZ, MENU)
        with open(origem, encoding='utf-8') as fh:
            html = ajustar(fh.read(), True)
        with open(os.path.join(pasta, 'index.html'), 'w', encoding='utf-8', newline='\n') as fh:
            fh.write(html)

        # os 3 apps, pra a chave estar no caminho de QUALQUER pagina que ela abra
        for app in APPS:
            with open(os.path.join(RAIZ, app), encoding='utf-8') as fh:
                html = ajustar(fh.read(), True)
            with open(os.path.join(pasta, app), 'w', encoding='utf-8', newline='\n') as fh:
                fh.write(html)

        with open(os.path.join(pasta, 'manifest.webmanifest'), 'w', encoding='utf-8', newline='\n') as fh:
            json.dump(manifest(chave), fh, ensure_ascii=False, indent=2)

        print('  ' + chave + '/  ->  index.html + ' + ' + '.join(APPS) + ' + manifest')

    print('\nPastas montadas a partir de UMA fonte. Nunca edite dentro da pasta:')
    print('edite ' + MENU + ' / ' + ' / '.join(APPS) + ' e rode este script de novo.')

if __name__ == '__main__':
    main()
