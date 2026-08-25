"use client";

import { useCallback, useEffect, useState } from "react";


interface Profile {
  username: string;
  fullName: string;
  profilePicUrl: string;
  followersCount?: number;
}

interface Sub {
  username: string;
  full_name: string;
  profile_pic: string;
}


interface Video {
  id: string;
  username: string;
  caption: string;
  video_url: string;
  thumbnail_url: string;
  post_url: string;
  timestamp: string;
  full_name?: string;
  profile_pic?: string;
}
