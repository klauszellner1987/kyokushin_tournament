# -*- coding: utf-8 -*-
import os
belts = ['10. Kyu','9. Kyu','8. Kyu','7. Kyu','6. Kyu','5. Kyu','4. Kyu','3. Kyu','2. Kyu','1. Kyu','1. Dan','2. Dan','3. Dan']
dojos = ['SHINKYO Dojo Berlin','Budokan Muenchen','Kyokushin Hamburg','Dojo am Rhein Koeln','Karate Frankfurt','Seishin Dojo Stuttgart','Tsunami Dresden','Kanku Leipzig','Osaka Wesel','Sunabe Hannover','Shin Dojo Nuernberg','Kanreikan Essen','Kokoro Bonn','Seido Karlsruhe','Hombu Muenster','Dojo Mitte Dortmund','Bushido Wiesbaden','Shinken Aachen','Karate Dojo Mainz','Kyokushkai Freiburg','Seiken Trier','Dojo Nord Kiel','Honbu Luebeck']
first_m = ['Lukas','Noah','Ben','Finn','Jonas','Tom','Paul','David','Marcel','Sven','Kai','Erik','Jan','Tim','Niklas','Max','Leon','Felix','Julian','Moritz','Simon','Robin','Jannis','Aaron','Phil']
first_w = ['Anna','Mia','Lisa','Sara','Hannah','Julia','Sophie','Lena','Nina','Emma','Lea','Marie','Laura','Sarah','Katha','Clara','Julie','Nele','Finja','Mila','Zoe','Amelie','Lia','Paula','Jana']
last = ['Mueller','Schmidt','Schneider','Fischer','Weber','Meyer','Wagner','Becker','Hoffmann','Koch','Richter','Klein','Wolf','Schulz','Neumann','Lang','Berger','Hartmann','Krause','Vogel','Zimmermann','Braun','Frank','Lorenz','Baumann','Schuster','Peters','Werner','Krueger','Herrmann']
header_de = 'Vorname;Nachname;Verein;Geburtsdatum;Gewicht;Gürtelgrad;Geschlecht;Disziplin'

def pad(n):
    return '{:02d}'.format(n)

def date_for_age(age, month, day):
    from datetime import datetime
    y = datetime.now().year - age
    return '{}.{}.{}'.format(pad(day), pad(month), y)

rows = []
for i in range(150):
    w = (i % 2 == 0)
    fn = first_w[i % len(first_w)] if w else first_m[i % len(first_m)]
    suffix = '-{}'.format(i // 30) if i >= 30 else ''
    ln = last[(i * 7) % len(last)] + suffix
    club = dojos[i % len(dojos)]
    age = 8 + (i % 52)
    month = 1 + (i % 12)
    day = 1 + (i % 28)
    bd = date_for_age(age, month, day)
    if age < 12:
        weight = 28 + (i % 18)
    elif age < 16:
        weight = 42 + (i % 25)
    elif w:
        weight = 52 + (i % 28)
    else:
        weight = 68 + (i % 35)
    belt = belts[i % len(belts)]
    r = i % 10
    if r < 4:
        disc = 'kumite'
    elif r < 6:
        disc = 'kata'
    else:
        disc = 'kumite,kata'
    rows.append(';'.join([fn, ln, club, bd, str(weight), belt, 'W' if w else 'M', disc]))

root = r'c:\Users\zellne_k\Tournament\e2e\fixtures'
os.makedirs(root, exist_ok=True)
with open(os.path.join(root, 'teilnehmer_150.csv'), 'w', encoding='utf-8') as f:
    f.write(header_de + '\n')
    f.write('\n'.join(rows) + '\n')

bad = rows[:149] + ['Fehler;Testperson;' + dojos[0] + ';01.06.2000;75;13. Kyu;M;kumite']
with open(os.path.join(root, 'teilnehmer_150_mit_fehlerzeile.csv'), 'w', encoding='utf-8') as f:
    f.write(header_de + '\n')
    f.write('\n'.join(bad) + '\n')
print('ok', len(rows), len(bad))
