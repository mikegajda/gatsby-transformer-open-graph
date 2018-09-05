# gatsby-transformer-open-graph

My first attempt at a gatsby plugin. It looks for `MarkdownRemark` nodes that have a `link` property. If that is found, it will try to find the Open Graph metadata for that link and adds it to the remark node. Still a bit buggy, and it relies on the metascraper library which `npm audit` reports has a major vulnerability. Despite this, it works for my link blog at [mikegajda.com](https://mikegajda.com)

# Installation
`npm install gatsby-transformer-open-graph`

# Usage and Configuration
At this time there are no configuration options