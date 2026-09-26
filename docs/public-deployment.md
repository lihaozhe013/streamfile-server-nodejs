# Public read-only deployment

This setup is for one Bun process behind one host-level Nginx reverse proxy.
Nginx terminates HTTPS. Only Nginx should be reachable from the internet; the
application port must remain bound to loopback. The supplied proxy has no
unconditional request, connection, or bandwidth limits.

## Configure the application

Set these flags in `~/.config/stream-file-server/config.yaml` before starting
the public server:

```yaml
features:
  upload: false
  privateFiles: false
  homePage: false
  publicTrafficLimits: true
```

The existing configuration file is never rewritten. Restart the server after
editing it. `publicTrafficLimits` is optional and defaults to `false`; when
false, this feature installs no request or transfer limits and emits no proxy
speed-limit header. The other feature flags are independent.

Review the contents of `files/` before publishing. Regular-file symlinks can
serve targets outside that directory. The `privateFiles` flag controls whether
direct URLs into the private directory are served.

## Keep the backend private

Run the container with `.container/compose.public.yaml` instead of the regular
Compose file. It publishes port 3000 only on `127.0.0.1`:

```bash
docker compose -f .container/compose.public.yaml up -d
```

For a native binary or `bun server.js`, set `server.host: '127.0.0.1'` in the
same config file. Do not publish or forward port 3000 from the public network.

## Configure Nginx

Use your HTTPS server block and certificate management. Copy
`.container/nginx-public.location.conf` into an Nginx snippet and include it
inside that server block. For example:

```nginx
server {
    listen 443 ssl;
    server_name docs.example.com;
    ssl_certificate /path/to/fullchain.pem;
    ssl_certificate_key /path/to/privkey.pem;
    include /path/to/nginx-public.location.conf;
}
```

Replace the domain, certificate paths, and snippet path with values for the
host. The snippet overwrites incoming `X-Forwarded-For`,
`X-Forwarded-Host`, and `X-Forwarded-Proto` before forwarding. Do not append
user-supplied forwarding headers or allow an alternate public path to Bun.
If a CDN is added later, configure Nginx to accept real-client IP information
only from the CDN's published addresses, then recheck the forwarded address.

Leave Nginx processing of `X-Accel-Limit-Rate` and `X-Accel-Buffering` enabled.
The supplied snippet disables proxy buffering by default and disables proxy
temporary files. When `publicTrafficLimits` is true, Bun sends both headers on
responses backed by files larger than 1 MiB; Nginx enables bounded memory
buffering and applies the 512 KiB/s response limit. Buffering is required for
the rate limit to work reliably. When the flag is false, Bun sends neither
header and the proxy applies no limit. See the
[Nginx rate-limit documentation](https://nginx.org/en/docs/http/ngx_http_core_module.html#limit_rate)
and [proxy header documentation](https://nginx.org/en/docs/http/ngx_http_proxy_module.html#proxy_ignore_headers).

Check the Nginx configuration before reloading it:

```bash
nginx -t
```

## Verify the path

Use the public HTTPS URL for these checks, not port 3000. Confirm that an
ordinary document opens and that a raw file accepts a range request:

```bash
curl -i 'https://docs.example.com/files/example.bin?raw=1' -H 'Range: bytes=0-15'
```

The range response should be `206` with `Content-Range`. Repeated requests
should eventually return `429` with `Retry-After: 60` while the feature is
enabled. A 429 API response is JSON. Confirm that sending a forged
`X-Forwarded-For` header to Nginx does not change which visitor quota is used.
For a file larger than 1 MiB, compare transfer times through Nginx with the
feature on and off. A direct request to the backend port from another host
must fail.

The limits are stored in one process and reset on restart. They slow bulk
downloads but do not prevent an anonymous visitor from copying public files
over time. Review Nginx access logs for 429 responses and downloaded bytes
when adjusting the fixed policy for a real audience.
