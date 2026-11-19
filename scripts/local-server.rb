#!/usr/bin/env ruby
# Local development server for ShuShu Workspace (zero external dependencies)

require 'webrick'
require 'json'

def load_env
  vars = {}
  if File.exist?('.env')
    File.readlines('.env').each do |line|
      line = line.strip
      next if line.empty? || line.start_with?('#')
      k, v = line.split('=', 2)
      vars[k.strip] = (v || '').strip if k
    end
  end
  vars
end

port = (ENV['PORT'] || 4173).to_i

server = WEBrick::HTTPServer.new(
  Port: port,
  BindAddress: '127.0.0.1',
  DocumentRoot: File.expand_path('..', __dir__),
  MimeTypes: WEBrick::HTTPUtils::DefaultMimeTypes.merge(
    'js'   => 'application/javascript; charset=utf-8',
    'mjs'  => 'application/javascript; charset=utf-8',
    'css'  => 'text/css; charset=utf-8',
    'json' => 'application/json; charset=utf-8',
    'svg'  => 'image/svg+xml',
    'ics'  => 'text/calendar; charset=utf-8'
  )
)

server.mount_proc '/api/config' do |_req, res|
  env_vars = load_env
  res.status = 200
  res['Content-Type'] = 'application/json; charset=utf-8'
  res['Cache-Control'] = 'no-store'
  res.body = JSON.generate({
    supabaseUrl: env_vars['SUPABASE_URL'] || '',
    supabaseAnonKey: env_vars['SUPABASE_ANON_KEY'] || '',
    singleUserDomain: env_vars['SINGLE_USER_EMAIL_DOMAIN'].to_s.empty? ? 'shushu.app' : env_vars['SINGLE_USER_EMAIL_DOMAIN']
  })
end

trap('INT') { server.shutdown }
trap('TERM') { server.shutdown }

puts "ShuShu local server running at http://127.0.0.1:#{port}"
server.start
