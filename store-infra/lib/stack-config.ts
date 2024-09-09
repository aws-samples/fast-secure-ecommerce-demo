export const stackConfig = {

    S3_TRANSFORMED_IMAGE_EXPIRATION_DURATION: 90,
    S3_TRANSFORMED_IMAGE_CACHE_TTL: "max-age=31622400",
    LAMBDA_MEMORY: 1500,
    LAMBDA_TIMEOUT: 60,
    GITHUB_REPO: "https://github.com/aws-samples/fast-secure-ecommerce-demo"
    
    } as const;
