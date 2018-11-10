const crypto = require(`crypto`)
const Queue = require(`better-queue`)
const { createRemoteFileNode } = require(`gatsby-source-filesystem`)

async function getMetadata(targetUrl) {
  const { body: html, url } = await got(targetUrl)
  const metadata = await metascraper({ html, url })
  return metadata
}

const metascraper = require('metascraper')([
  require('metascraper-image')(),
  require('metascraper-title')(),
  require('metascraper-date')(),
  require('metascraper-url')(),
  require('metascraper-description')(),
  require('metascraper-publisher')(),
  require('metascraper-author')(),
])

const got = require('got')

function getMetaData(url) {
  ;(async () => {
    const { body: html, url } = await got(targetUrl)
    const metadata = await metascraper({ html, url })
    return metadata
  })()
}

const opengraphQueue = new Queue(
  (input, cb) => {
    createOpengraphNode(input)
      .then(r => cb(null, r))
      .catch(e => cb(e))
  },
  { concurrent: 20, maxRetries: 2, retryDelay: 1000 }
)

const createContentDigest = obj =>
  crypto
    .createHash(`md5`)
    .update(JSON.stringify(obj))
    .digest(`hex`)

exports.onPreBootstrap = (
  { store, cache, actions, createNodeId, getNodes },
  pluginOptions
) => {
  const { createNode, touchNode } = actions
  const opengraphNodes = getNodes().filter(n => n.internal.type === `Opengraph`)

  if (opengraphNodes.length === 0) {
    return null
  }

  let anyQueued = false

  opengraphNodes.forEach(n => {
    anyQueued = true
    opengraphQueue.push({
      url: n.url,
      parent: n.parent,
      store,
      cache,
      createNode,
      createNodeId,
    })
  })

  if (!anyQueued) {
    return null
  }

  return new Promise((resolve, reject) => {
    opengraphQueue.on(`drain`, () => {
      resolve()
    })
  })
}

exports.onCreateNode = async ({
  node,
  actions,
  store,
  cache,
  createNodeId,
}) => {
  const { createNode, createParentChildLink } = actions

  //console.log("node.internal.type=", node.internal.type)

  // Only get MarkdownRemark nodes
  if (node.internal.type !== `MarkdownRemark`) {
    return
  } else {
    if (!node.frontmatter.link) {
      return
    }
  }

  const opengraphNode = await new Promise((resolve, reject) => {
    opengraphQueue
      .push({
        url: node.frontmatter.link,
        parent: node.id,
        store,
        cache,
        createNode,
        createNodeId,
      })
      .on(`finish`, r => {
        resolve(r)
      })
      .on(`failed`, e => {
        reject(e)
      })
  })

if (opengraphNode && opengraphNode.id){
  createParentChildLink({
    parent: node,
    child: opengraphNode,
  });
}
else {
  return;
}
  
}

const createOpengraphNode = async ({
  url,
  parent,
  store,
  cache,
  createNode,
  createNodeId,
}) => {
  try {
    console.info('TEST process opengraph data for = ', url)

    const targetUrl = url

    const metadata = await getMetadata(targetUrl)

    // if (metadata.title === "Terms of Service Violation"){
    //   console.log("ERROR Bloomberg TOS Violation, returning")
    //   return
    // }

    //console.log("metadata = ", metadata)

    let fixedImageUrl = metadata.image
    if (metadata.image && metadata.image.includes('wsj')) {
      fixedImageUrl = fixedImageUrl + '?image.jpg'
    }

    const fileNode = await createRemoteFileNode({
      url: fixedImageUrl,
      store,
      cache,
      createNode,
      createNodeId,
    })

    if (!fileNode) {
      //console.error(`Remote file node is null`, metadata.image)
      throw new Error(`Remote file node is null`, metadata.image)
    }

    const opengraphNode = {
      id: createNodeId(`${parent} >>> Opengraph`),
      url,
      description: metadata.description,
      publisher: metadata.publisher,
      title: metadata.title,
      date: metadata.date,
      imageUrl: metadata.image,
      parent,
      children: [],
      internal: {
        type: `Opengraph`,
      },
      image___NODE: fileNode.id,
    }

    opengraphNode.internal.contentDigest = createContentDigest(opengraphNode)

    createNode(opengraphNode)

    return opengraphNode
  } catch (e) {
    console.log(`Failed to opengraph ${url} due to ${e}. Will skip OpenGraph for this article...`)

    //throw e
  }
}
