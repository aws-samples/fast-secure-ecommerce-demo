const chrome = require('selenium-webdriver/chrome');
const { Builder, By, Key, until } = require('selenium-webdriver');

const start = async function () {

    const screen = {
        width: 640,
        height: 480
    };

    let driver = new Builder()
        .forBrowser('chrome')
        .setChromeOptions(new chrome.Options()
            .addArguments('--headless')
            .windowSize(screen)
            .addArguments([
                'user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
            ]))
        .build();

    var domainName = process.argv[2]

    console.log("\x1b[33m loading homepage \x1b[0m");


    driver.get(domainName)
        .then(_ => {
            driver.sleep(5000).then(function () {
                driver.getPageSource().then(function (html) {
                    //console.log(html);
                    /*driver.manage().getCookies().then(function (cookies) {
                        console.log(cookies);
                    });*/
                    console.log("\x1b[33m-> scraping product links \x1b[0m");
                    driver.findElements(By.xpath('/html/body/div/div/main/div/a')).then(function (elems) {
                        if (elems.length === 0) {
                            console.log("\x1b[33m-> product links not found  \x1b[0m");
                        } else {
                            elems[0].getAttribute("href").then(function (productLink) {
                                console.log("\x1b[33m-> first product found->  \x1b[0m", productLink);
                                console.log("\x1b[33m-> loading this product page  \x1b[0m");
                                driver.get(productLink)
                                    .then(_ =>
                                        driver.getPageSource().then(function (html) {
                                            //console.log(html);
                                            driver.findElements(By.xpath('/html/body/div/div/main/div/div')).then(function (elems) {
                                                if (elems.length === 0) {
                                                    console.log("\x1b[33m-> no data is found on the pro \x1b[0m");
                                                } else {
                                                    console.log("\x1b[33m-> scraping product data \x1b[0m");
                                                    elems.forEach(function (elem) {
                                                        elem.getText().then(function (text) {
                                                            console.log(`\x1b[32m${text} \x1b[0m`);


                                                        });
                                                    });
                                                }
                                            })
                                        })
                                    )
                            });
                        }

                    })

                });
            })
        })
}

start();
