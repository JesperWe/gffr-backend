## Install droplet

```
apt update
apt upgrade
apt-get install -y bash-completion build-essential git curl sudo ufw language-pack-en
curl -sL https://deb.nodesource.com/setup_14.x -o nodesource_setup.sh
bash nodesource_setup.sh
apt install nodejs
rm nodesource_setup.sh
npm i -g yarn pm2
apt-get install -y nginx
# vi /etc/bash.bashrc # enable completion
snap install core; snap refresh core
snap install --classic certbot
ln -s /snap/bin/certbot /usr/bin/certbot
certbot --nginx
git config --global credential.helper cache
git config --global credential.helper "cache --timeout=3600000"

https://github.com/JesperWe/grff-backend.git
...

# Frontend start:
pm2 start npm --name "my_app_name" -- start
pm2 startup
pm2 save
```

## nginx config

```
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    
    root /var/www/html;
    index index.html index.htm index.nginx-debian.html;
    
    server_name _;
    
    location / {
            try_files $uri $uri/ =404;
    }
}

server {
    root /var/www/html;
    index index.html index.htm index.nginx-debian.html;
    server_name api.fossilfuelregistry.org; # managed by Certbot
        
    location / {
        proxy_pass     http://127.0.0.1:3000;
    }   
    
    listen [::]:443 ssl ipv6only=on; # managed by Certbot
    listen 443 ssl; # managed by Certbot
    ssl_certificate /etc/letsencrypt/live/api.fossilfuelregistry.org/fullchain.pem; # managed by Certbot
    ssl_certificate_key /etc/letsencrypt/live/api.fossilfuelregistry.org/privkey.pem; # managed by Certbot
    include /etc/letsencrypt/options-ssl-nginx.conf; # managed by Certbot
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem; # managed by Certbot
}

server {
    if ($host = api.fossilfuelregistry.org) {
        return 301 https://$host$request_uri;
    } # managed by Certbot
        
    listen 80 ;
    listen [::]:80 ;
    server_name api.fossilfuelregistry.org;
    return 404; # managed by Certbot
}
```