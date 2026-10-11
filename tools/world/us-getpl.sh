cd "$(dirname "$0")/pl"
extract(){ ab=$1
  awk -F'|' 'NR==FNR{if($3=="060"&&$5=="00")g[$8]=$10;next} ($5 in g){print g[$5]","$6}' ${ab}geo2020.pl ${ab}000012020.pl > ${ab}.csv && rm -f ${ab}geo2020.pl ${ab}000012020.pl; }

while read ab name; do
  [ -s ${ab}.csv ] && continue
  curl -s -m 900 -o $ab.zip "https://www2.census.gov/programs-surveys/decennial/2020/data/01-Redistricting_File--PL_94-171/$name/${ab}2020.pl.zip" && unzip -oq $ab.zip ${ab}geo2020.pl ${ab}000012020.pl && rm -f $ab.zip && extract $ab && echo "ok $ab $(wc -l < $ab.csv)" || echo "FAIL $ab"
done < ../states.txt
echo DONE
