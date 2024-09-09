#!/bin/bash 
# this bash scripts tests the delay of blocking an IP that exceeds a request rate limit threshold
rl_limit=$2 #Rate limit that needs to be tested
url=$1 #URL where rate limit is applied

# send the a number of request matching the limit
counter=0
until [ $counter = $rl_limit ]
do
result=$(curl -I --silent -H 'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36' $url | grep -e HTTP/)
echo $(date +%s) : request number $(($counter+1)) : $result
((counter=counter+1))
done

t_start=$(date +%s)

# send the a number of request beyong the limit until blocked
counter=0
result=''
until [[ $(echo $result | grep '403') == *"403"* ]]
do
result=$(curl -I --silent -H 'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36' $url | grep -e HTTP/)
echo $(date +%s) : request number $(($counter+1)) : $result
((counter=counter+1))
done

t_end=$(date +%s)
elapsed_time=$(($t_end-$t_start))
echo total time to block : $elapsed_time seconds
