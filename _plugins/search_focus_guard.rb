# Just the Docs 0.12.0 assumes focusout always has a relatedTarget. Browsers
# legitimately send null when focus leaves the page or moves to non-focusable
# content. Patch the rendered theme asset so its own hideSearch behavior runs.
# Remove this compatibility patch when upgrading to a theme with the upstream fix.
require "digest"

Jekyll::Hooks.register :pages, :post_render do |page|
  next unless page.url == "/assets/js/just-the-docs.js"

  original = "const nextFocusedElement = evt.relatedTarget;"
  unless page.output.scan(original).length == 1
    raise "Theme search focus handler changed; review _plugins/search_focus_guard.rb"
  end

  page.output = page.output.sub(original, <<~JS.strip)
    #{original}
        if (!nextFocusedElement) {
          hideSearch();
          return;
        }
  JS
end

# Fingerprint the corrected asset after all pages have rendered. A freshly
# loaded page must not reuse the previous theme script from a browser cache.
Jekyll::Hooks.register :site, :post_render do |site|
  script = site.pages.find { |page| page.url == "/assets/js/just-the-docs.js" }
  raise "Theme script missing; review _plugins/search_focus_guard.rb" unless script

  version = Digest::SHA256.hexdigest(script.output)[0, 12]
  site.pages.each do |page|
    next unless page.output_ext == ".html"

    page.output = page.output.sub(
      %r{(src="[^"]*/assets/js/just-the-docs\.js)(")},
      "\\1?v=#{version}\\2"
    )
  end
end
