function handler(event) {
const request = event.request;
const response = event.response;
  // x-user-segment header is set by the viewer request function
  if (request.headers['x-user-segment']) {
      const userSegment = request.headers["x-user-segment"].value;
      response.cookies['user-segment'] = { value: userSegment };
  }
  return response;
}