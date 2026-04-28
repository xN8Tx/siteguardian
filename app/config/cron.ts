import { Core } from "@strapi/strapi";
import { XMLParser } from "fast-xml-parser";

type ISite = {
  title: string;
  sitemap?: string;
  url?: Array<{ url: string }>;
};

type CheckResult = {
  url: string;
  code: number;
  time: string;
  comment: string;
};

class Checker {
  private responses: CheckResult[] = [];
  private site: ISite;

  constructor(site: ISite) {
    this.site = site;
  }

  public async run() {
    const urls = this.site.sitemap
      ? await this.fetchAndParseSitemap()
      : this.prepareUrl();

    if (!urls || !urls?.length) return;

    await Promise.all(urls.map((url) => this.checkUrlConnection(url)));

    return this.responses;
  }

  private statusHandler(url: string, status: number, comment?: string) {
    const res: CheckResult = {
      url,
      code: status,
      comment,
      time: new Date().toLocaleTimeString(),
    };

    this.responses.push(res);
  }

  private prepareUrl(): string[] | void {
    const url = this.site.url;

    if (!url) return;

    return url.map((s) => s.url);
  }

  private async checkUrlConnection(url: string) {
    try {
      const res = await strapi.fetch(url);

      this.statusHandler(url, res.status);
    } catch (error) {
      this.statusHandler(url, error?.cause?.code, error?.cause?.reason);
    }
  }

  private async fetchAndParseSitemap(): Promise<string[] | void> {
    try {
      const res = await strapi.fetch(this.site.sitemap);
      const xml = await res.text();

      if (!xml) return this.statusHandler(this.site.sitemap, res.status);

      const parser = new XMLParser();
      const json = parser.parse(xml);

      const sitemapUrl = json?.urlset?.url as Array<{ loc: string }>;

      if (!sitemapUrl)
        return this.statusHandler(
          this.site.sitemap,
          res.status,
          "No site map url",
        );

      return sitemapUrl.map((s) => s.loc);
    } catch (error) {
      this.statusHandler(
        this.site.sitemap,
        error?.cause?.code,
        error?.cause?.reason,
      );
    }
  }
}

export default {
  requestSites: {
    task: async ({ strapi }: { strapi: Core.Strapi }) => {
      const sitesCount = await strapi.documents("api::site.site").count({});

      const sites = await strapi.documents("api::site.site").findMany({
        populate: {
          url: true,
        },
        pageSize: sitesCount,
      });

      const telegramSender = strapi
        .plugin("strapi-v5-telegram-bot")
        .service("telegramSender");

      await Promise.allSettled(
        sites.map(async (site) => {
          const checker = new Checker(site as ISite);

          const result = await checker.run();
          const errorResult = result.filter((r) => r.code !== 200);

          const response = await strapi
            .documents("api::response.response")
            .create({
              data: {
                site: site,
                date: new Date(),
                response: JSON.stringify(result),
                failedResponse: JSON.stringify(errorResult),
              },
            });

          if (errorResult.length) {
            const res = await telegramSender.sendMessage(
              `🚨 ${site.title} have to failure pages ${errorResult.length} pages!\n <a href="https://localhst:1337//admin/content-manager/collection-types/api::response.response/${response.documentId}">👉 Learn more here </a>`,
            );
          }
        }),
      );
    },
    options: {
      rule: "*/4",
    },
  },
};
