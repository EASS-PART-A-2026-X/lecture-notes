# Course components: turn plain, GitHub-friendly Markdown conventions into styled site markup.
#
# Authors write ordinary Markdown (see .github/CONTRIBUTING.md, "Authoring components"):
#   **Predict first:** ...                    -> <p class="callout callout--predict">
#   > **Simpler is enough:** ...              -> <blockquote class="callout callout--optional">
#   > **At a glance** + a list                -> <blockquote class="glance">
#   [← Course home](../README.md) · ...       -> <p class="page-nav">
# Lecture pages 01-10 also get <main class="lecture-page"> (phase markers in CSS) and a
# section panel around six stable sections. The README gets its home-page hooks (hero, start
# path, and the calendar and deadlines tables that assets/js/course.js reads). On every page,
# each table body cell carries its column name (data-label), a table with three or more
# columns gets class="stack" (phones show it as labelled cards), and short code tokens in cells
# are wrapped so that the screen never splits them at a hyphen.
#
# String transforms only, on Just the Docs 0.12.0 + kramdown output. Like
# search_focus_guard.rb, the hook raises when an expected shape is missing, so a theme or
# structure change fails the build instead of silently dropping the design. It never touches
# <script> or <h1> elements and never adds ids (check_site.py rejects duplicate ids).

require "cgi/escape"

module CourseComponents
  CALLOUT_LABELS = {
    "objectives" => ["You will be able to:", "Objectives:"],
    "prereq" => ["Before you start:", "Prerequisite check:", "Bridge if needed:", "Repair:", "You need:"],
    "predict" => ["Predict first:", "Predict:", "Warm-up:", "Warm-up from earlier classes:"],
    "explain" => ["Explain after:", "Investigate:", "Trace it:", "Defend it:", "Debug log:", "Explain it:",
                  "Parsons:"],
    "checkpoint" => ["Checkpoint:", "Done when:", "Completion evidence:", "Check yourself:", "EX1 progress:",
                     "EX2 progress:", "EX3 progress:"],
    "pitfall" => ["Pitfall:", "Common pitfall:", "Watch out:", "Security:"],
    "optional" => ["Optional:", "Stretch:", "Advanced (optional):", "Simpler is enough:", "Go deeper (optional):",
                   "Optional; not graded:"],
    "note" => ["Note:", "Version note:", "Checked:", "Policy:"],
  }.freeze

  # Exact, case-sensitive label (including the colon) -> kind.
  KIND_BY_LABEL = CALLOUT_LABELS.each_with_object({}) do |(kind, labels), map|
    labels.each { |label| map[label] = kind }
  end.freeze

  GLANCE_TITLE = "At a glance".freeze

  # Lecture sections whose content is wrapped in a panel (h2 id -> panel kind).
  SECTION_PANELS = {
    "before-you-start" => "prereq",
    "learning-checkpoint" => "objectives",
    "completion-check" => "checkpoint",
    "stretch-goals" => "optional",
    "common-pitfalls" => "pitfall",
    "instructor-notes" => "instructor",
  }.freeze

  LECTURE_PAGE = %r{\Alectures/(?:0[1-9]|10)-[^/]+\.md\z}

  # One pass over the tags that decide nesting, plus the two label shapes. A label paragraph is
  # a callout only at the top level of the page content: not inside a list item and not inside
  # another blockquote (callout or glance).
  TOKEN = %r{
    (?<bq_open><blockquote>)(?=\s*<p><strong>(?<bq_label>[^<]{1,60})</strong>(?<bq_rest></p>)?)
   |(?<bq_plain><blockquote\b[^>]*>)
   |(?<bq_close></blockquote>)
   |(?<li_open><li\b[^>]*>)
   |(?<li_close></li>)
   |(?<p_label><p><strong>(?<p_text>[^<]{1,60})</strong>)
  }x

  module_function

  def applies?(page)
    return false unless page.output_ext == ".html"

    path = page.path.to_s
    path == "README.md" || path.start_with?("lectures/", "guides/")
  end

  def transform(path, html, baseurl = "")
    fail_shape(path, "expected exactly one <main> element") unless html.scan(/<main\b/).length == 1

    head, main_open, rest = html.partition(/<main\b[^>]*>/)
    body, main_close, tail = rest.partition("</main>")

    body = label_components(body)
    body = page_nav(body, baseurl)
    if LECTURE_PAGE.match?(path)
      body = section_panels(path, body)
      main_open = main_open.sub("<main>", '<main class="lecture-page">')
      fail_shape(path, "<main> already has attributes; cannot mark the lecture page") unless main_open.include?("lecture-page")
    end
    body = home_page(path, body) if path == "README.md"
    body = tables(body)

    head + main_open + body + main_close + tail
  end

  # (a) callouts and (b) the at-a-glance card.
  def label_components(html)
    stack = []                # :li, :bq, :callout, :glance (innermost last)
    label_next = nil          # :callout or :glance: style the first child paragraph of that blockquote

    html.gsub(TOKEN) do
      m = Regexp.last_match
      if m[:bq_open]
        nested = !stack.empty?
        if m[:bq_label] == GLANCE_TITLE && m[:bq_rest] && !nested
          stack << :glance
          label_next = :glance
          '<blockquote class="glance">'
        elsif !nested && (kind = KIND_BY_LABEL[m[:bq_label]])
          stack << :callout
          label_next = :callout
          %(<blockquote class="callout callout--#{kind}">)
        else
          stack << :bq
          label_next = nil
          m[0]
        end
      elsif m[:bq_plain]
        stack << :bq
        label_next = nil
        m[0]
      elsif m[:bq_close]
        stack.pop if %i[bq callout glance].include?(stack.last)
        m[0]
      elsif m[:li_open]
        stack << :li
        m[0]
      elsif m[:li_close]
        stack.pop if stack.last == :li
        m[0]
      else # p_label
        text = m[:p_text]
        if label_next == :glance
          label_next = nil
          %(<p class="glance-title"><strong>#{text}</strong>)
        elsif label_next == :callout
          label_next = nil
          %(<p><strong class="callout-label">#{text}</strong>)
        elsif stack.empty? && (kind = KIND_BY_LABEL[text])
          %(<p class="callout callout--#{kind}"><strong class="callout-label">#{text}</strong>)
        else
          m[0]
        end
      end
    end
  end

  # (c) The hand-written navigation line(s). Lectures: the first paragraph whose first link
  # starts with "←", and its bottom copy. Guides: a links-only line right after the title that
  # starts with the course home link.
  def page_nav(html, baseurl)
    arrows = html.to_enum(:scan, /<p>(?=<a\s[^>]*>\s*←)/).map { Regexp.last_match.begin(0) }
    first_h2 = html.index("<h2") || html.length
    top = arrows.first if arrows.first && arrows.first < first_h2
    if top.nil?
      home = Regexp.escape("#{baseurl.to_s.chomp("/")}/")
      intro = html.match(%r{\A\s*(?:<!--.*?-->\s*)*<h1\b.*?</h1>\s*(?:<!--.*?-->\s*)*(?=<p><a href="#{home}">)}m)
      top = intro.end(0) if intro && intro.end(0) < first_h2
    end
    bottom = arrows.last if arrows.length > 1 && arrows.last > first_h2

    out = html.dup
    out[bottom, 3] = '<p class="page-nav page-nav--bottom">' if bottom
    out[top, 3] = '<p class="page-nav">' if top
    out
  end

  # (d) Section panels on lecture pages 01-10.
  def section_panels(path, html)
    SECTION_PANELS.each do |id, kind|
      opener = %(<h2 id="#{id}")
      count = html.scan(opener).length
      fail_shape(path, %(expected exactly one <h2 id="#{id}">, found #{count})) unless count == 1

      start = html.index(opener)
      heading_end = html.index("</h2>", start) or fail_shape(path, %(unclosed <h2 id="#{id}">))
      heading_end += "</h2>".length
      next_h2 = html.index(/<h2\s/, heading_end) or fail_shape(path, %(section "#{id}" must be followed by another <h2>))

      content = html[heading_end...next_h2]
      %w[details div blockquote].each do |tag|
        opened = content.scan(/<#{tag}\b/).length
        closed = content.scan(%r{</#{tag}>}).length
        next if opened == closed

        fail_shape(path, %(section "#{id}" has unbalanced <#{tag}> (#{opened} open, #{closed} closed); ) +
                         "keep headings out of HTML wrappers")
      end

      html = html[0...heading_end] +
             %(<div class="section-panel section-panel--#{kind}">) + content + "</div>" +
             html[next_h2..]
    end
    html
  end

  # (e) Home page hooks.
  BOARD_SLOT = '<aside class="this-week" data-pending aria-hidden="true"></aside>'

  def home_page(path, html)
    h1 = html.index("<h1") or fail_shape(path, "home page needs its <h1>")
    actions = "<p><strong>On this page:</strong>"
    fail_shape(path, %(expected one "**On this page:**" paragraph)) unless html.scan(actions).length == 1
    actions_at = html.index(actions)
    fail_shape(path, %("**On this page:**" must follow the title)) unless actions_at > h1
    actions_end = html.index("</p>", actions_at) + "</p>".length

    hero = html[h1...actions_end]
    facts_at = hero.index("<ul>") or fail_shape(path, "expected the facts list (<ul>) after the title")
    hero[facts_at, 4] = '<ul class="home-facts">'
    hero = hero.sub(actions, %(<p class="home-actions"><strong>On this page:</strong>))
    # course.js fills this empty board under the title after the page has painted; reserving its
    # place now keeps the facts and the introduction from jumping down when it arrives. A
    # <noscript> style (head_custom.html) hides it when scripts are off.
    title_end = hero.index("</h1>") or fail_shape(path, "the home title needs its </h1>")
    title_end += "</h1>".length
    hero = hero[0...title_end] + BOARD_SLOT + hero[title_end..]
    html = html[0...h1] + %(<div class="home-hero">) + hero + "</div>" + html[actions_end..]

    html = mark_after(path, html, '<h2 id="start-here"', "<ol>", '<ol class="start-path">')
    html = mark_after(path, html, '<h2 id="calendar-and-13-meeting-schedule"', "<table>", '<table class="schedule">')
    # course.js reads the next deadline for the home-page board from this table.
    html = mark_after(path, html, '<h2 id="assignments-and-deadlines"', "<table>", '<table class="deadlines">')
    # Phones show both tables as cards labelled from their header row (see tables below).
    %w[schedule deadlines].each do |name|
      table = html[%r{<table class="#{name}">.*?</table>}m]
      fail_shape(path, "#{name} table needs a header row") unless table.include?("<thead>")
    end
    html
  end

  def mark_after(path, html, heading, tag, replacement)
    start = html.index(heading) or fail_shape(path, "missing #{heading}>")
    limit = html.index(/<h2\s/, start + heading.length) || html.length
    at = html.index(tag, start)
    fail_shape(path, "expected #{tag} directly under #{heading}>") unless at && at < limit
    html[0...at] + replacement + html[(at + tag.length)..]
  end

  # (f) Tables. Every table with a header row: each body cell gets data-label="<its column
  # name>" (tags stripped, attribute-escaped; "" for an empty header). A table with three or
  # more columns also gets the class "stack" (merged with schedule/deadlines), which phones show
  # as one labelled card per row; when every first cell is a number ("Step | …" with 1, 2, 3),
  # "stack--numbered" lets the card title read "Step 1". Tables without a header row are left
  # alone. Inside cells, short code tokens that contain a break point (a hyphen, slash, colon…)
  # are wrapped in <span class="nobr">, so `git --version` wraps at its space, never after "--".
  STACK_MIN_COLUMNS = 3
  NOBR_MAX_CHARS = 16
  TABLE = %r{<table\b([^>]*)>(.*?)</table>}m
  CELL_CODE = %r{(<code\b[^>]*>)([^<]*)(</code>)}

  def tables(html)
    html.gsub(TABLE) do
      attrs = Regexp.last_match(1)
      inner = Regexp.last_match(2)
      head = inner[%r{<thead>.*?</thead>}m]
      next "<table#{attrs}>#{inner}</table>" unless head

      headers = head.scan(%r{<th\b[^>]*>(.*?)</th>}m).flatten.map { |h| plain_text(h) }
      firsts = []
      inner = inner.gsub(%r{<tbody>.*?</tbody>}m) do |tbody|
        tbody.gsub(%r{<tr>(.*?)</tr>}m) do
          column = -1
          cells = Regexp.last_match(1).gsub(%r{<td\b([^>]*)>(.*?)</td>}m) do
            cell_attrs = Regexp.last_match(1)
            content = Regexp.last_match(2)
            column += 1
            firsts << plain_text(content) if column.zero?
            label = CGI.escapeHTML(headers[column].to_s)
            %(<td#{cell_attrs} data-label="#{label}">#{keep_tokens(content)}</td>)
          end
          "<tr>#{cells}</tr>"
        end
      end

      if headers.length >= STACK_MIN_COLUMNS
        attrs = add_class(attrs, "stack")
        numbered = !firsts.empty? && firsts.all? { |text| text.match?(/\A\d{1,3}\z/) }
        attrs = add_class(attrs, "stack--numbered") if numbered && !["", "#"].include?(headers.first)
      end
      "<table#{attrs}>#{inner}</table>"
    end
  end

  # Tags stripped, entities decoded, whitespace (including the no-break space kramdown writes
  # into an empty header cell) collapsed.
  def plain_text(html)
    CGI.unescapeHTML(html.gsub(/<[^>]+>/, "")).gsub(/[[:space:]]+/, " ").strip
  end

  def add_class(attrs, name)
    return %(#{attrs} class="#{name}") unless attrs.include?('class="')

    attrs.sub(/class="([^"]*)"/) { %(class="#{Regexp.last_match(1)} #{name}") }
  end

  # Letters, digits, "_", "." and "," never offer a line break inside a word; most other
  # characters (-, /, :, ?) can, so a short token holding any of them is kept whole.
  def keep_tokens(cell)
    cell.gsub(CELL_CODE) do
      open_tag = Regexp.last_match(1)
      code = Regexp.last_match(2)
      close_tag = Regexp.last_match(3)
      tokens = code.gsub(/\S+/) do |token|
        text = CGI.unescapeHTML(token)
        if text.length.between?(2, NOBR_MAX_CHARS) && text.match?(/[^A-Za-z0-9_.,]/)
          %(<span class="nobr">#{token}</span>)
        else
          token
        end
      end
      open_tag + tokens + close_tag
    end
  end

  def fail_shape(path, message)
    raise "course_components: #{path}: #{message} (see _plugins/course_components.rb)"
  end
end

Jekyll::Hooks.register :pages, :post_render do |page|
  next unless CourseComponents.applies?(page)

  page.output = CourseComponents.transform(page.path.to_s, page.output, page.site.baseurl)
end
