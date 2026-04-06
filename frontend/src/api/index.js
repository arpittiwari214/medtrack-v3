// frontend/src/api/index.js
import client from "./client";

export const authAPI = {
  signup:          (data)      => client.post("/auth/signup",     data),
  login:           (data)      => client.post("/auth/login",      data),
  me:              ()          => client.get("/auth/me"),
  updateCaregiver: (data)      => client.patch("/auth/caregiver", data),
  updateProfile:   (data)      => client.patch("/auth/profile",   data),
};

export const medicinesAPI = {
  getAll:   ()       => client.get("/medicines"),
  create:   (data)   => client.post("/medicines",         data),
  update:   (id, d)  => client.patch(`/medicines/${id}`,  d),
  delete:   (id)     => client.delete(`/medicines/${id}`),
  complete: (id)     => client.patch(`/medicines/${id}/complete`),
};

export const logsAPI = {
  getAll:    (params) => client.get("/logs", { params }),
  markTaken: (id)     => client.patch(`/logs/${id}/taken`),
  snooze:    (id, m)  => client.patch(`/logs/${id}/snooze`, { minutes: m }),
  undo:      (id)     => client.patch(`/logs/${id}/undo`),
  skip:      (id)     => client.patch(`/logs/${id}/skip`),
  delete:    (id)     => client.delete(`/logs/${id}`),
};

export const alertsAPI = {
  getAll:  ()    => client.get("/alerts"),
  resolve: (id)  => client.patch(`/alerts/${id}/resolve`),
  sos:     ()    => client.post("/alerts/sos"),
};
