# Give the theme's generated styles a source fingerprint, so a returning browser can distinguish
# a visual release from a cached stylesheet. Keep Jekyll/Pages' existing static asset paths.
require "digest"

module CourseStylesheetCache
  ROOT = File.expand_path("..", __dir__)
  SOURCES = (Dir.glob(File.join(ROOT, "_sass", "**", "*.{scss,sass,css}")) +
             Dir.glob(File.join(ROOT, "assets", "css", "**", "*.{scss,sass,css}")) +
             [File.join(ROOT, "_config.yml"), File.join(ROOT, "Gemfile.lock")]).sort.freeze
  VERSION = Digest::SHA256.hexdigest(SOURCES.map { |path| path.delete_prefix(ROOT) + "\0" + File.binread(path) }.join("\0"))[0, 12].freeze
end

Jekyll::Hooks.register :pages, :post_render do |page|
  next unless page.output_ext == ".html"

  page.output = page.output.gsub(%r{href="([^"]*/assets/css/just-the-docs-(?:default|head-nav)\.css)"}) do
    %(href="#{Regexp.last_match(1)}?v=#{CourseStylesheetCache::VERSION}")
  end
end
